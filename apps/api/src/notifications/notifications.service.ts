import { Inject, Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import type { Prisma, User } from '@prisma/client';
import { formatDate, formatPrice, formatTime } from '@rental/i18n';
import { fromLocationDateTime, rentalDays, toLocationDate, type Lang } from '@rental/shared';
import { IncidentsService, JOB_INCIDENT_ESCALATE } from '../bookings/incidents.service';
import { BookingEvents, paidTotal, type BookingEvent } from '../bookings';
import { Clock, JOB_REMINDER, JobsService, type JobData } from '../jobs';
import { PrismaService } from '../prisma/prisma.service';
import { RatesService } from '../rates/rates.service';
import { AlertService } from './alert.service';
import { NOTIFIER, renderBotText, type Notifier, type NotifierButton, type NotifierParams } from './notifier';

export const JOB_RETURN_REMINDER = 'booking.return-reminder';
export const JOB_OVERDUE = 'booking.overdue';
export const JOB_TOMORROW_SUMMARY = 'notify.tomorrow-summary';
const H = 3_600_000;
const SUMMARY_HOUR = '20:00';
const SUMMARY_EVERY_MS = 10 * 60_000;
const BIKE_DUE_DAYS = 7;

const INCLUDE = {
  user: true,
  model: { select: { name: true } },
  bike: { select: { plate: true } },
  location: true,
  extras: { include: { extra: { select: { name: true } } } },
  payments: true,
} satisfies Prisma.BookingInclude;
type Booking = Prisma.BookingGetPayload<{ include: typeof INCLUDE }>;

type StaffRecipient = Pick<User, 'telegramId' | 'lang'>;

const openButton = (id: string): NotifierButton => ({ textKey: 'bot.open', startapp: `booking_${id}` });

/**
 * Уведомления бота по событиям броней (BookingEvents) и задачам очереди (JobsService).
 * Получатель и язык — из профиля пользователя; каждое сообщение с кнопкой startapp=booking_<id>.
 */
@Injectable()
export class NotificationsService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger('Notifications');
  private unsubscribe: (() => void) | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly incidents: IncidentsService,
    private readonly events: BookingEvents,
    private readonly jobs: JobsService,
    private readonly clock: Clock,
    private readonly rates: RatesService,
    private readonly alerts: AlertService,
    @Inject(NOTIFIER) private readonly notifier: Notifier,
  ) {}

  onModuleInit(): void {
    this.unsubscribe = this.events.subscribe((e) => this.bookingEvent(e.bookingId, e));
    this.job(JOB_REMINDER, (d) => this.onReminder(d));
    this.job(JOB_RETURN_REMINDER, (d) => this.onReturnReminder(d));
    this.job(JOB_OVERDUE, (d) => this.onOverdue(d));
    this.job(JOB_INCIDENT_ESCALATE, (d) => this.onIncidentEscalate(d));
    this.jobs.every(JOB_TOMORROW_SUMMARY, SUMMARY_EVERY_MS, () => this.runTomorrowSummary().catch((e: unknown) => this.failed(JOB_TOMORROW_SUMMARY, e)));
  }

  onModuleDestroy(): void {
    this.unsubscribe?.();
  }

  /** Обработчик задачи: сбой → алерт администратору и повтор очередью. */
  private job(name: string, fn: (d: JobData) => Promise<void>): void {
    this.jobs.register(name, async (d) => {
      try {
        await fn(d);
      } catch (e) {
        await this.failed(name, e);
        throw e;
      }
    });
  }

  private async failed(name: string, e: unknown): Promise<void> {
    await this.alerts.alert(`Job ${name} failed: ${(e as Error).message}`);
  }

  // ---------- События ----------

  /** Точка входа для событий броней (подписка на BookingEvents). Ошибки доставки не влияют на бронь. */
  async bookingEvent(bookingId: string, event: Pick<BookingEvent, 'name' | 'params'>): Promise<void> {
    const b = await this.load(bookingId);
    if (!b) return;
    const p = event.params ?? {};
    switch (event.name) {
      case 'created':
        await this.onCreated(b);
        break;
      case 'confirmed':
        await this.onConfirmed(b);
        break;
      case 'rub_transfer_claimed':
        await this.toAdmins('bot.admin.rubTransferClaimed', { code: b.code, rub: new Intl.NumberFormat('ru-RU').format(Number(p.rub ?? 0)), client: this.clientName(b.user), phone: b.phone ?? b.user.phone ?? '-' });
        break;
      case 'rub_transfer_not_found':
        await this.toClient(b, 'bot.client.rubTransferNotFound', { code: b.code });
        break;
      case 'cancelled':
      case 'no_show':
        await this.onCancelled(b);
        break;
      case 'expired':
        await this.toClient(b, 'bot.client.expired', { code: b.code });
        await this.stopJobs(b.id);
        break;
      case 'status_changed':
        await this.onStatusChanged(b, String(p.to ?? ''));
        break;
      case 'problem':
        await this.toManagers(b, 'bot.manager.problem', { ...this.common(b), phone: b.phone ?? b.user.phone ?? '-', comment: typeof p.comment === 'string' ? p.comment : '' });
        break;
      case 'incident_opened': {
        const source = String(p.source ?? 'CLIENT');
        await this.toStaff(b, source === 'SYSTEM' ? 'bot.manager.bikeNotReturned' : 'bot.manager.bikeMissing', { ...this.common(b), plate: b.bike.plate, phone: b.phone ?? b.user.phone ?? '-', comment: typeof p.comment === 'string' ? p.comment : '-' });
        break;
      }
      case 'incident_proposed':
        await this.toClient(b, 'bot.client.replacementOffer', { code: b.code, model: String(p.model ?? ''), plate: String(p.plate ?? '') });
        break;
      case 'incident_resolved':
        await this.onIncidentResolved(b, String(p.resolution ?? ''), Number(p.refund ?? 0), String(p.model ?? ''));
        break;
      case 'bike_reassigned':
        await this.toManagers(b, 'bot.manager.bikeReassigned', { ...this.common(b), plate: String(p.plate ?? '') });
        break;
      case 'deposit_deducted':
        await this.toAdmins('bot.admin.depositDeducted', { code: b.code, amountVnd: Number(p.amountVnd ?? 0), __booking: b });
        break;
      case 'payment_mismatch': {
        const expected = Number(p.expected ?? 0);
        const received = Number(p.received ?? 0);
        await this.toManagers(b, 'bot.manager.paymentMismatch', { code: b.code, expectedVnd: expected, receivedVnd: received });
        await this.alerts.alert(`Payment mismatch ${b.code}: expected ${expected}, received ${received}`);
        break;
      }
      case 'payment_after_cancel':
        await this.toManagers(b, 'bot.manager.paymentAfterCancel', { code: b.code, amountVnd: Number(p.amount ?? 0) });
        await this.alerts.alert(`Payment after cancel ${b.code}: ${Number(p.amount ?? 0)}`);
        break;
      case 'refunded':
        await this.toClient(b, 'bot.client.refunded', { code: b.code, amount: await this.money(Number(p.amount ?? 0), b.user) });
        break;
      default:
        break; // refund_recorded — клиенту сообщать нечего (сумма возврата — в сообщении об отмене)
    }
  }

  /** Документы проверяет администратор: новая бронь — повод посмотреть очередь, пока клиент не приехал. */
  private async onCreated(b: Booking): Promise<void> {
    const waiting = await this.prisma.document.count({ where: { userId: b.userId, deletedAt: null, status: 'UPLOADED' } });
    if (waiting > 0) await this.toAdmins('bot.admin.documentsToCheck', { code: b.code, client: this.clientName(b.user), count: waiting });
  }

  private async onConfirmed(b: Booking): Promise<void> {
    const cash = b.paymentMethod === 'CASH';
    const unpaid = Math.max(0, b.totalAmount + b.depositAmount - paidTotal(b.payments));
    // Перевод в рублях закрывает только аренду: остаток — депозит наличными при выдаче
    const depositAtPickup = b.paymentMethod === 'RUB_TRANSFER' && unpaid > 0;
    await this.toClient(b, cash ? 'bot.client.confirmedCash' : depositAtPickup ? 'bot.client.confirmedDepositCash' : 'bot.client.confirmed', {
      ...this.common(b),
      address: b.location.address,
      contact: await this.contact(b),
      amount: await this.money(cash || depositAtPickup ? unpaid : 0, b.user),
    });
    if (!cash) await this.sendReceipt(b);
    await this.toManagers(b, cash || depositAtPickup ? 'bot.manager.newBookingCash' : 'bot.manager.newBooking', { ...this.common(b), amountVnd: unpaid });
  }

  private async onCancelled(b: Booking): Promise<void> {
    const refund = b.refundAmount ?? 0;
    if (refund > 0) await this.toClient(b, 'bot.client.cancelledRefund', { code: b.code, refund: await this.money(refund, b.user) });
    else await this.toClient(b, 'bot.client.cancelled', { code: b.code });
    await this.toManagers(b, 'bot.manager.cancelled', this.common(b));
    await this.stopJobs(b.id);
  }

  private async onStatusChanged(b: Booking, to: string): Promise<void> {
    if (to === 'ISSUED') return this.scheduleReturnJobs(b);
    if (to === 'COMPLETED') {
      await this.stopJobs(b.id);
      await this.toClient(b, 'bot.client.rate', { code: b.code });
    } else if (to === 'CANCELLED_BY_SYSTEM' || to === 'CANCELLED_BY_CLIENT') {
      // отмена администратором и т. п.: события cancelled/expired/no_show уже отправили свои сообщения
      // BIKE_MISSING: своё сообщение с извинением уходит из incident_resolved
      if (b.cancelReason === 'ADMIN') await this.onCancelled(b);
      else await this.stopJobs(b.id);
    } else if (to === 'PROBLEM') {
      await this.stopJobs(b.id);
    }
  }

  private async onIncidentResolved(b: Booking, resolution: string, refund: number, model: string): Promise<void> {
    if (resolution === 'BIKE_PRESENT') {
      await this.toClient(b, 'bot.client.bikeFound', { code: b.code, address: b.location.address });
      // Клиент говорит «нет», точка — «есть»: администратор должен видеть такие расхождения
      return this.toAdmins('bot.admin.incidentDismissed', { code: b.code, address: b.location.address, phone: b.phone ?? b.user.phone ?? '-' });
    }
    if (resolution === 'REPLACED') {
      await this.toClient(b, 'bot.client.replaced', { code: b.code, model });
      return this.toStaff(b, 'bot.manager.replaced', { ...this.common(b), model });
    }
    if (resolution === 'CANCELLED') {
      await this.toClient(b, 'bot.client.bikeMissingCancelled', { code: b.code, refund: await this.money(refund, b.user) });
      await this.toStaff(b, 'bot.manager.bikeMissingCancelled', { ...this.common(b), refundVnd: refund });
    }
  }

  /** Точка не ответила на «байка нет»: пишем администратору платформы, клиенту открываем отмену с полным возвратом. */
  private async onIncidentEscalate(d: JobData): Promise<void> {
    if (typeof d.incidentId !== 'string') return;
    const incident = await this.prisma.bookingIncident.findUnique({ where: { id: d.incidentId } });
    if (!incident || incident.status !== 'OPEN' || incident.proposedAt) return;
    const b = await this.load(incident.bookingId);
    if (!b) return;
    await this.prisma.bookingIncident.update({ where: { id: incident.id }, data: { escalatedAt: this.clock.now() } });
    await this.toAdmins('bot.admin.incidentNoAnswer', { code: b.code, model: b.model.name, address: b.location.address, phone: b.phone ?? b.user.phone ?? '-', __booking: b });
    if (incident.clientReportedAt && !incident.disputed) await this.toClient(b, 'bot.client.bikeMissingWait', { code: b.code });
  }

  /** Важное для контроля владельцев: пишем всем администраторам платформы. */
  async adminNotice(key: string, params: Record<string, unknown>): Promise<void> {
    await this.toAdmins(key, params);
  }

  private async toAdmins(key: string, params: Record<string, unknown>): Promise<void> {
    for (const a of await this.admins()) await this.send(a, key, this.localized(params, a.lang));
  }

  private async sendReceipt(b: Booking): Promise<void> {
    const paid = b.payments.filter((p) => p.status === 'PAID' && p.kind !== 'REFUND');
    if (!paid.length) return;
    const lang = b.user.lang;
    const tz = b.location.timezone;
    const money = (v: number) => this.money(v, b.user);
    const days = ((b.quote as { days?: number } | null)?.days ?? rentalDays(b.startAt, b.endAt)) || 1;
    const lines = [`${renderBotText('bot.receipt.rent', { lang, days })}: ${await money(b.rentAmount)}`];
    for (const x of b.extras) lines.push(`${x.extra.name ? (x.extra.name as Record<string, string>)[lang] ?? (x.extra.name as Record<string, string>).en : ''} x${x.qty}: ${await money(x.amount)}`);
    if (b.deliveryAmount > 0) lines.push(`${renderBotText('bot.receipt.delivery', { lang })}: ${await money(b.deliveryAmount)}`);
    if (b.depositAmount > 0 && b.paymentMethod !== 'RUB_TRANSFER') lines.push(`${renderBotText('bot.receipt.deposit', { lang })}: ${await money(b.depositAmount)}`);
    if (b.discountAmount > 0) lines.push(`-${await money(b.discountAmount)}`);
    const last = paid.reduce((a, p) => ((p.paidAt?.getTime() ?? 0) > (a.paidAt?.getTime() ?? 0) ? p : a));
    const at = last.paidAt ?? this.clock.now();
    await this.toClient(b, 'bot.client.receipt', {
      code: b.code,
      lines: lines.join('\n'),
      total: await money(paidTotal(b.payments)),
      method: renderBotText(`bot.method.${last.method}`, { lang }),
      paidAt: `${formatDate(at, lang, tz)} ${formatTime(at, lang, tz)}`,
    });
  }

  // ---------- Задачи ----------

  private async onReminder(d: JobData): Promise<void> {
    const b = d.bookingId ? await this.load(d.bookingId) : null;
    if (!b || b.status !== 'CONFIRMED') return;
    const kind = d.kind === '2h' ? '2h' : '24h';
    const mapUrl = `https://www.google.com/maps/search/?api=1&query=${b.location.lat},${b.location.lng}`;
    await this.toClient(b, `bot.client.reminder${kind}`, { ...this.common(b), address: b.location.address, mapUrl });
    if (kind === '24h') {
      const docs = await this.prisma.document.count({ where: { userId: b.userId, deletedAt: null } });
      if (docs === 0) await this.toClient(b, 'bot.client.docs', { code: b.code });
    }
  }

  private async scheduleReturnJobs(b: Booking): Promise<void> {
    const now = this.clock.now().getTime();
    for (const [kind, hours] of [['12h', 12], ['2h', 2]] as const) {
      const at = new Date(b.endAt.getTime() - hours * H);
      if (at.getTime() > now) await this.jobs.schedule(JOB_RETURN_REMINDER, `return-${kind}-${b.id}`, at, { bookingId: b.id, kind });
    }
    const grace = await this.lateRules();
    await this.jobs.schedule(JOB_OVERDUE, `overdue-${b.id}`, new Date(b.endAt.getTime() + grace.graceMinutes * 60_000), { bookingId: b.id });
  }

  private async stopJobs(bookingId: string): Promise<void> {
    await Promise.all([`return-12h-${bookingId}`, `return-2h-${bookingId}`, `overdue-${bookingId}`].map((id) => this.jobs.cancel(id)));
  }

  private async onReturnReminder(d: JobData): Promise<void> {
    const b = d.bookingId ? await this.load(d.bookingId) : null;
    if (!b || b.status !== 'ISSUED') return;
    const soon = d.kind === '2h';
    await this.toClient(b, soon ? 'bot.client.returnReminder2h' : 'bot.client.returnReminder', { code: b.code, end: this.when(b.endAt, b.user.lang, b), address: b.location.address });
    if (soon) await this.toStaff(b, 'bot.manager.returnSoon', { ...this.common(b), plate: b.bike.plate, phone: b.phone ?? b.user.phone ?? '-' });
  }

  private async onOverdue(d: JobData): Promise<void> {
    const b = d.bookingId ? await this.load(d.bookingId) : null;
    if (!b || b.status !== 'ISSUED') return;
    const late = await this.lateRules();
    const end = this.when(b.endAt, b.user.lang, b);
    await this.toClient(b, 'bot.client.overdue', { code: b.code, end, hourlyFee: await this.money(late.hourlyFee, b.user), contact: await this.contact(b) });
    await this.toStaff(b, 'bot.manager.overdue', { ...this.common(b), phone: b.phone ?? b.user.phone ?? '-' });
    await this.incidents.handleOverdue(b.id);
  }

  /** Сводка выдач на завтра: после 20:00 по часам точки, один раз в сутки на точку (отметка в AuditLog). */
  async runTomorrowSummary(): Promise<void> {
    const now = this.clock.now();
    const locations = await this.prisma.location.findMany({ where: { isActive: true } });
    for (const loc of locations) {
      const today = toLocationDate(now, loc.timezone);
      if (formatTime(now, 'vi', loc.timezone) < SUMMARY_HOUR) continue;
      const marker = `${loc.id}:${today}`;
      if (await this.prisma.auditLog.findFirst({ where: { action: 'notify.summary', entity: 'Location', entityId: marker } })) continue;
      const tomorrow = toLocationDate(new Date(now.getTime() + 24 * H), loc.timezone);
      const after = toLocationDate(new Date(now.getTime() + 48 * H), loc.timezone);
      const rows = await this.prisma.booking.findMany({
        where: { locationId: loc.id, status: 'CONFIRMED', startAt: { gte: fromLocationDateTime(tomorrow, '00:00', loc.timezone), lt: fromLocationDateTime(after, '00:00', loc.timezone) } },
        orderBy: { startAt: 'asc' },
        include: INCLUDE,
      });
      await this.prisma.auditLog.create({ data: { action: 'notify.summary', entity: 'Location', entityId: marker, diff: { bookings: rows.length } } });
      for (const m of await this.managersOf(loc.id)) {
        const lang = m.lang;
        const date = formatDate(fromLocationDateTime(tomorrow, '12:00', loc.timezone), lang, loc.timezone);
        const key = rows.length ? 'bot.manager.summary' : 'bot.manager.summaryEmpty';
        const list = rows.map((r) => renderBotText('bot.manager.summaryLine', { lang, time: formatTime(r.startAt, lang, loc.timezone), model: r.model.name, code: r.code, client: this.clientName(r.user) })).join('\n');
        await this.send(m, key, { date, list }, { textKey: 'bot.openToday', startapp: 'manager' });
      }
      await this.summaryForStaff(loc, tomorrow, after, now);
    }
  }

  /** Вечером менеджерам и администраторам: кто завтра возвращает байк и у каких байков подходят страховка и ТО. */
  private async summaryForStaff(loc: { id: string; timezone: string }, tomorrow: string, after: string, now: Date): Promise<void> {
    const [returns, due] = await Promise.all([
      this.prisma.booking.findMany({
        where: { locationId: loc.id, status: 'ISSUED', endAt: { gte: fromLocationDateTime(tomorrow, '00:00', loc.timezone), lt: fromLocationDateTime(after, '00:00', loc.timezone) } },
        orderBy: { endAt: 'asc' },
        include: INCLUDE,
      }),
      this.prisma.bike.findMany({
        where: {
          locationId: loc.id,
          status: { not: 'RETIRED' },
          OR: [{ insuranceUntil: { lte: new Date(now.getTime() + BIKE_DUE_DAYS * 24 * H) } }, { serviceDate: { lte: new Date(now.getTime() + BIKE_DUE_DAYS * 24 * H) } }],
        },
        orderBy: { plate: 'asc' },
        select: { plate: true, insuranceUntil: true, serviceDate: true },
      }),
    ]);
    if (!returns.length && !due.length) return;
    const limit = now.getTime() + BIKE_DUE_DAYS * 24 * H;
    for (const m of await this.staffOf(loc.id)) {
      const lang = m.lang;
      if (returns.length) {
        const date = formatDate(fromLocationDateTime(tomorrow, '12:00', loc.timezone), lang, loc.timezone);
        const list = returns.map((r) => renderBotText('bot.manager.summaryLine', { lang, time: formatTime(r.endAt, lang, loc.timezone), model: r.model.name, code: r.code, client: this.clientName(r.user) })).join('\n');
        await this.send(m, 'bot.manager.returnsSummary', { date, list }, { textKey: 'bot.openToday', startapp: 'manager' });
      }
      if (due.length) {
        const list = due
          .flatMap((b) => [
            ...(b.insuranceUntil && b.insuranceUntil.getTime() <= limit ? [renderBotText('bot.manager.dueInsurance', { lang, plate: b.plate, date: formatDate(b.insuranceUntil, lang, loc.timezone) })] : []),
            ...(b.serviceDate && b.serviceDate.getTime() <= limit ? [renderBotText('bot.manager.dueService', { lang, plate: b.plate, date: formatDate(b.serviceDate, lang, loc.timezone) })] : []),
          ])
          .join('\n');
        await this.send(m, 'bot.manager.bikesDue', { list });
      }
    }
  }

  /** Трекер показывает движение, а аренды нет: возможен угон. */
  async bikeMoving(bikeId: string): Promise<void> {
    const bike = await this.prisma.bike.findUnique({ where: { id: bikeId }, include: { model: { select: { name: true } } } });
    if (!bike) return;
    const mapUrl = `https://www.google.com/maps/search/?api=1&query=${bike.lastLat},${bike.lastLng}`;
    for (const m of await this.staffOf(bike.locationId)) await this.send(m, 'bot.manager.bikeMoving', { plate: bike.plate, model: bike.model.name, speed: Math.round(bike.lastSpeedKmh ?? 0), mapUrl });
    await this.alerts.alert(`Bike ${bike.plate} is moving without a rental`);
  }

  // ---------- Помощники ----------

  private load(id: string): Promise<Booking | null> {
    return this.prisma.booking.findUnique({ where: { id }, include: INCLUDE });
  }

  private when(d: Date, lang: Lang, b: Booking): string {
    return `${formatDate(d, lang, b.location.timezone)} ${formatTime(d, lang, b.location.timezone)}`;
  }

  /** Поля, общие для сообщений: код, модель, даты на языке получателя подставляются в `toClient/toManagers`. */
  private common(b: Booking): Record<string, unknown> {
    return { code: b.code, model: b.model.name, client: this.clientName(b.user), __booking: b };
  }

  private clientName(u: Pick<User, 'firstName' | 'lastName' | 'username' | 'telegramId'>): string {
    const name = [u.firstName, u.lastName].filter(Boolean).join(' ');
    return name || (u.username ? `@${u.username}` : u.telegramId);
  }

  /** Сумма на языке и в валюте отображения получателя (с пересчётом по курсу). */
  private async money(vnd: number, u: Pick<User, 'lang' | 'currency'>): Promise<string> {
    if (u.currency === 'VND') return formatPrice(vnd, u.lang);
    const rates = await this.rates.get().catch(() => null);
    return formatPrice(vnd, u.lang, rates && u.currency in rates ? { currency: u.currency, rate: rates[u.currency as 'RUB' | 'USD'] } : undefined);
  }

  /** Контакт точки брони; не задан — общий из настроек. */
  private async contact(b: Booking): Promise<string> {
    if (b.location.contact) return b.location.contact;
    const row = await this.prisma.setting.findUnique({ where: { key: 'managerContact' } });
    return typeof row?.value === 'string' ? row.value : '-';
  }

  private async lateRules(): Promise<{ graceMinutes: number; hourlyFee: number }> {
    const v = ((await this.prisma.setting.findUnique({ where: { key: 'late' } }))?.value ?? {}) as Record<string, unknown>;
    return { graceMinutes: typeof v.graceMinutes === 'number' ? v.graceMinutes : 60, hourlyFee: typeof v.hourlyFee === 'number' ? v.hourlyFee : 0 };
  }

  private async managersOf(locationId: string): Promise<StaffRecipient[]> {
    const managers = await this.prisma.user.findMany({ where: { role: { in: ['MANAGER', 'OWNER'] }, locationId, isDemo: false } });
    return managers.length ? managers : this.admins();
  }

  /** Администраторы: роль в БД и ADMIN_TELEGRAM_IDS. ID из .env может ещё не иметь записи в БД — ему пишем по ID. */
  private async admins(): Promise<StaffRecipient[]> {
    const ids = (process.env.ADMIN_TELEGRAM_IDS ?? '').split(',').map((v) => v.trim()).filter(Boolean);
    const rows = await this.prisma.user.findMany({ where: { OR: [{ role: 'ADMIN', isDemo: false }, { telegramId: { in: ids } }] } });
    const known = new Set(rows.map((u) => u.telegramId));
    return [...rows, ...ids.filter((id) => !known.has(id)).map((telegramId) => ({ telegramId, lang: 'ru' as const }))];
  }

  /** Менеджеры и владелец точки и все администраторы: о сроках возврата должны знать все. */
  private async staffOf(locationId: string): Promise<StaffRecipient[]> {
    const managers = await this.prisma.user.findMany({ where: { role: { in: ['MANAGER', 'OWNER'] }, locationId, isDemo: false } });
    const admins = await this.admins();
    const known = new Set(admins.map((a) => a.telegramId));
    return [...admins, ...managers.filter((m) => !known.has(m.telegramId))];
  }

  private async send(to: Pick<User, 'telegramId' | 'lang'>, key: string, params: Record<string, unknown>, button?: NotifierButton): Promise<void> {
    try {
      await this.notifier.send(to.telegramId, key, { ...params, lang: to.lang } as NotifierParams, button);
    } catch (e) {
      this.log.error(`${key} -> ${to.telegramId}: ${(e as Error).message}`);
    }
  }

  /** Даты (start, end) и суммы `*Vnd` → строки на языке получателя. */
  private localized(params: Record<string, unknown>, lang: Lang): Record<string, unknown> {
    const { __booking, ...raw } = params as { __booking?: Booking } & Record<string, unknown>;
    const rest: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(raw)) {
      if (k.endsWith('Vnd') && typeof v === 'number') rest[k.slice(0, -3)] = formatPrice(v, lang);
      else rest[k] = v;
    }
    if (!__booking) return rest;
    return { ...rest, start: this.when(__booking.startAt, lang, __booking), end: this.when(__booking.endAt, lang, __booking) };
  }

  private toClient(b: Booking, key: string, params: Record<string, unknown>): Promise<void> {
    return this.send(b.user, key, this.localized(params, b.user.lang), openButton(b.id));
  }

  private async toStaff(b: Booking, key: string, params: Record<string, unknown>): Promise<void> {
    for (const m of await this.staffOf(b.locationId)) await this.send(m, key, this.localized(params, m.lang), openButton(b.id));
  }

  private async toManagers(b: Booking, key: string, params: Record<string, unknown>): Promise<void> {
    for (const m of await this.managersOf(b.locationId)) await this.send(m, key, this.localized(params, m.lang), openButton(b.id));
  }
}
