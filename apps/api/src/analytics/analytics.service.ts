import { Injectable, type OnModuleInit } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { Clock } from '../jobs/clock';
import { JobsService } from '../jobs/jobs.service';
import { PrismaService } from '../prisma/prisma.service';

const JOB_ANALYTICS_CLEANUP = 'analytics.cleanup';
const DAY_MS = 86_400_000;
/** Сводка смотрит на 30 дней назад; запас — на сравнения. События пишутся без входа, бесконечно копить их нельзя. */
const RETENTION_DAYS = 180;

@Injectable()
export class AnalyticsService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jobs: JobsService,
    private readonly clock: Clock,
  ) {}

  onModuleInit(): void {
    this.jobs.every(JOB_ANALYTICS_CLEANUP, DAY_MS, async () => void (await this.purgeOld()));
  }

  async purgeOld(): Promise<number> {
    const { count } = await this.prisma.analyticsEvent.deleteMany({ where: { createdAt: { lt: new Date(this.clock.now().getTime() - RETENTION_DAYS * DAY_MS) } } });
    return count;
  }

  /** Событие воронки. Серверные события (например, `paid`) пишут другие модули через этот метод. */
  async track(userId: string | null, name: string, props: Record<string, unknown> | null = null, source: string | null = null): Promise<void> {
    await this.prisma.analyticsEvent.create({
      data: { userId, name, props: (props ?? undefined) as Prisma.InputJsonValue | undefined, source },
    });
  }
}
