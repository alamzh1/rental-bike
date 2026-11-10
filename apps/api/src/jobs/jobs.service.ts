import { Injectable, Logger, type OnApplicationBootstrap, type OnModuleDestroy } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { Queue, Worker, type ConnectionOptions } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { sendAlert } from './alerts';

// Очереди. Драйвер: BullMQ (Redis по REDIS_URL) или память процесса — JOBS_DRIVER=bullmq|memory;
// по умолчанию BullMQ, если задан REDIS_URL (в тестах — память). Обработчики регистрируют модули-владельцы
// (`register`, `every`), фасад для броней — scheduleHoldExpiry / scheduleReminders / cancelForBooking.

export type JobData = Record<string, unknown> & { bookingId?: string };
export type JobHandler = (data: JobData) => Promise<void>;

export const JOB_HOLD_EXPIRY = 'booking.hold-expiry';
/** Напоминание за 24 ч и за 2 ч до выдачи: data = { bookingId, kind: '24h' | '2h' }. Обработчик — модуль уведомлений. */
export const JOB_REMINDER = 'booking.reminder';
export const REMINDER_OFFSETS = { '24h': 24 * 3_600_000, '2h': 2 * 3_600_000 } as const;

const QUEUE = 'rental';
const MAX_TIMER = 2_147_000_000;
const ADD_TIMEOUT_MS = 3_000;

function redisConnection(url: string): ConnectionOptions {
  const u = new URL(url);
  return {
    host: u.hostname,
    port: Number(u.port || 6379),
    username: u.username || undefined,
    password: u.password ? decodeURIComponent(u.password) : undefined,
    db: u.pathname.length > 1 ? Number(u.pathname.slice(1)) : undefined,
    maxRetriesPerRequest: null,
  };
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('Redis timeout')), ms);
    p.then(
      (v) => (clearTimeout(t), resolve(v)),
      (e: unknown) => (clearTimeout(t), reject(e instanceof Error ? e : new Error(String(e)))),
    );
  });
}

@Injectable()
export class JobsService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly log = new Logger('Jobs');
  private readonly handlers = new Map<string, JobHandler>();
  private readonly recurring = new Map<string, number>();
  private readonly timers = new Map<string, NodeJS.Timeout>();
  private readonly intervals: NodeJS.Timeout[] = [];
  private queue: Queue | null = null;
  private worker: Worker | null = null;
  readonly driver: 'bullmq' | 'memory';

  constructor(
    private readonly prisma: PrismaService,
    private readonly moduleRef: ModuleRef,
  ) {
    const pref = process.env.JOBS_DRIVER;
    this.driver = pref === 'memory' || pref === 'bullmq' ? pref : process.env.REDIS_URL && !process.env.VITEST ? 'bullmq' : 'memory';
    if (this.driver === 'bullmq') {
      if (!process.env.REDIS_URL) throw new Error('JOBS_DRIVER=bullmq requires REDIS_URL');
      this.queue = new Queue(QUEUE, { connection: redisConnection(process.env.REDIS_URL) });
      this.queue.on('error', (e) => this.log.warn(`Redis: ${e.message}`));
    }
  }

  /** Обработчик задачи по имени (один на имя). */
  register(name: string, handler: JobHandler): void {
    this.handlers.set(name, handler);
  }

  /** Периодическая задача (свипер, ежедневная очистка). Запускается при старте приложения; в тестах не запускается. */
  every(name: string, everyMs: number, handler: JobHandler): void {
    this.register(name, handler);
    this.recurring.set(name, everyMs);
  }

  /** Выполнить обработчик сразу (повторный запуск безопасен: обработчики идемпотентны). */
  async run(name: string, data: JobData = {}): Promise<void> {
    const h = this.handlers.get(name);
    if (!h) {
      this.log.log(`Нет обработчика ${name}: ${JSON.stringify(data)}`);
      return;
    }
    await h(data);
  }

  /** Отложенная задача; `jobId` уникален — повторное планирование заменяет предыдущее. */
  async schedule(name: string, jobId: string, at: Date, data: JobData): Promise<void> {
    await this.cancel(jobId);
    const delay = Math.max(0, at.getTime() - Date.now());
    if (this.queue) {
      try {
        await withTimeout(this.queue.add(name, data, { jobId, delay, removeOnComplete: true, removeOnFail: 100, attempts: 3, backoff: { type: 'exponential', delay: 5_000 } }), ADD_TIMEOUT_MS);
        return;
      } catch (e) {
        this.log.warn(`Очередь недоступна, ${jobId} — таймер процесса: ${(e as Error).message}`);
      }
    }
    this.timer(name, jobId, at, data);
  }

  private timer(name: string, jobId: string, at: Date, data: JobData): void {
    const delay = Math.max(0, at.getTime() - Date.now());
    const t = setTimeout(
      () => {
        this.timers.delete(jobId);
        if (delay > MAX_TIMER) return this.timer(name, jobId, at, data);
        this.run(name, data).catch((e: unknown) => this.failed(name, jobId, e));
      },
      Math.min(delay, MAX_TIMER),
    );
    t.unref();
    this.timers.set(jobId, t);
  }

  async cancel(jobId: string): Promise<void> {
    const t = this.timers.get(jobId);
    if (t) {
      clearTimeout(t);
      this.timers.delete(jobId);
    }
    if (this.queue) {
      try {
        await withTimeout(this.queue.remove(jobId), ADD_TIMEOUT_MS);
      } catch {
        // задачи нет или Redis недоступен — свипер подстрахует
      }
    }
  }

  /** Есть ли запланированная задача в памяти процесса (для проверки в тестах). */
  hasTimer(jobId: string): boolean {
    return this.timers.has(jobId);
  }

  scheduleHoldExpiry(bookingId: string, at: Date): Promise<void> {
    return this.schedule(JOB_HOLD_EXPIRY, `hold-${bookingId}`, at, { bookingId });
  }

  /** Напоминания за 24 ч и 2 ч до выдачи; прошедшие моменты пропускаются. */
  async scheduleReminders(bookingId: string, startAt?: Date): Promise<void> {
    const start = startAt ?? (await this.prisma.booking.findUnique({ where: { id: bookingId }, select: { startAt: true } }))?.startAt;
    if (!start) return;
    for (const [kind, offset] of Object.entries(REMINDER_OFFSETS)) {
      const at = new Date(start.getTime() - offset);
      if (at.getTime() > Date.now()) await this.schedule(JOB_REMINDER, `reminder-${kind}-${bookingId}`, at, { bookingId, kind });
    }
  }

  async cancelForBooking(bookingId: string): Promise<void> {
    await Promise.all([`hold-${bookingId}`, ...Object.keys(REMINDER_OFFSETS).map((k) => `reminder-${k}-${bookingId}`)].map((id) => this.cancel(id)));
  }

  async onApplicationBootstrap(): Promise<void> {
    if (process.env.VITEST) return;
    if (this.queue && process.env.REDIS_URL) {
      this.worker = new Worker(QUEUE, async (job) => this.run(job.name, job.data as JobData), { connection: redisConnection(process.env.REDIS_URL) });
      this.worker.on('error', (e) => this.log.warn(`Worker: ${e.message}`));
      // Алерт — после последней попытки (attempts в schedule), промежуточные — только в лог.
      this.worker.on('failed', (job, e) => {
        const final = !job || job.attemptsMade >= (job.opts.attempts ?? 1);
        if (final) void this.failed(job?.name ?? 'unknown', job?.id ?? '', e);
        else this.log.warn(`${job.name} ${job.id} (попытка ${job.attemptsMade}): ${e.message}`);
      });
      for (const [name, every] of this.recurring) {
        try {
          await withTimeout(this.queue.upsertJobScheduler(name, { every }, { name, data: {} }), ADD_TIMEOUT_MS);
          continue;
        } catch (e) {
          this.log.warn(`Очередь недоступна, ${name} — интервал процесса: ${(e as Error).message}`);
        }
        this.interval(name, every);
      }
      return;
    }
    for (const [name, every] of this.recurring) this.interval(name, every);
  }

  private interval(name: string, every: number): void {
    const t = setInterval(() => this.run(name).catch((e: unknown) => this.failed(name, '', e)), every);
    t.unref();
    this.intervals.push(t);
  }

  /** Сбой задачи → лог и алерт администратору (история 87). Ошибка отправки алерта не пробрасывается. */
  private async failed(name: string, jobId: string, e: unknown): Promise<void> {
    const reason = e instanceof Error ? e.message : String(e);
    await sendAlert(this.moduleRef, this.log, `Job ${name}${jobId ? ` ${jobId}` : ''} failed: ${reason}`);
  }

  async onModuleDestroy(): Promise<void> {
    for (const t of this.timers.values()) clearTimeout(t);
    this.timers.clear();
    for (const t of this.intervals) clearInterval(t);
    await this.worker?.close().catch(() => undefined);
    await this.queue?.close().catch(() => undefined);
  }
}
