import { Test } from '@nestjs/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { JobsService } from '../src/jobs/jobs.service';
import { AlertService } from '../src/notifications/alert.service';
import { PrismaService } from '../src/prisma/prisma.service';

// История 87: падение любой задачи очереди — алерт в Telegram-чат администратора (AlertService.alert).
describe('JobsService: сбой задачи → AlertService.alert', () => {
  let jobs: JobsService;
  const alert = vi.fn(async (_text: string) => undefined);

  beforeEach(async () => {
    alert.mockClear();
    const moduleRef = await Test.createTestingModule({
      providers: [JobsService, { provide: PrismaService, useValue: {} }, { provide: AlertService, useValue: { alert } }],
    }).compile();
    jobs = moduleRef.get(JobsService);
  });

  afterEach(async () => {
    await jobs.onModuleDestroy();
  });

  it('отложенная задача упала → алерт с именем задачи и причиной', async () => {
    jobs.register('documents.cleanup', async () => {
      throw new Error('disk full');
    });
    await jobs.schedule('documents.cleanup', 'cleanup-1', new Date(), {});
    await vi.waitFor(() => expect(alert).toHaveBeenCalledTimes(1), { timeout: 1000 });
    expect(alert.mock.calls[0]![0]).toContain('documents.cleanup');
    expect(alert.mock.calls[0]![0]).toContain('disk full');
  });

  it('успешная задача — без алерта', async () => {
    let done = false;
    jobs.register('ok.job', async () => {
      done = true;
    });
    await jobs.schedule('ok.job', 'ok-1', new Date(), {});
    await vi.waitFor(() => expect(done).toBe(true), { timeout: 1000 });
    expect(alert).not.toHaveBeenCalled();
  });

  it('ошибка отправки алерта не роняет процесс', async () => {
    alert.mockRejectedValueOnce(new Error('telegram down'));
    jobs.register('bad.job', async () => {
      throw new Error('boom');
    });
    await jobs.schedule('bad.job', 'bad-1', new Date(), {});
    await vi.waitFor(() => expect(alert).toHaveBeenCalledTimes(1), { timeout: 1000 });
  });
});
