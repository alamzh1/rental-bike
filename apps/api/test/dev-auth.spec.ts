import { HttpException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService, devAuthEnabled } from '../src/auth/auth.service';
import type { PrismaService } from '../src/prisma/prisma.service';

// Вход тестовым пользователем (DEV_AUTH=1): только при явном NODE_ENV=development|test
// и только для client|manager|admin — как dev-вход админки (adminDevAuthEnabled).
const saved = { NODE_ENV: process.env.NODE_ENV, DEV_AUTH: process.env.DEV_AUTH, JWT_SECRET: process.env.JWT_SECRET };

function makeService() {
  const upsert = vi.fn(async ({ create }: { create: Record<string, unknown> }) => ({
    id: 'u1', firstName: 'Test', lastName: 'X', username: null, photoUrl: null, phone: null, lang: 'ru', currency: 'RUB',
    licenseCategory: null, verificationStatus: 'NONE', onboardedAt: null, ...create,
  }));
  const prisma = { user: { upsert } } as unknown as PrismaService;
  return { service: new AuthService(prisma, new JwtService()), upsert };
}

async function statusOf(p: Promise<unknown>): Promise<number> {
  try {
    await p;
    return 200;
  } catch (e) {
    if (e instanceof HttpException) return e.getStatus();
    throw e;
  }
}

describe('AuthService.loginDev', () => {
  beforeEach(() => {
    process.env.DEV_AUTH = '1';
    process.env.JWT_SECRET = 'test-only';
  });
  afterEach(() => {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });

  it.each([[''], [undefined], ['staging'], ['production']])('NODE_ENV=%s — вход закрыт, пользователь не создаётся', async (nodeEnv) => {
    if (nodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = nodeEnv;
    const { service, upsert } = makeService();
    expect(devAuthEnabled()).toBe(false);
    expect(await statusOf(service.loginDev('admin'))).toBe(401);
    expect(upsert).not.toHaveBeenCalled();
  });

  it.each([['toString'], ['__proto__'], ['constructor'], ['root'], ['']])('devUser=%s — 400, пользователь не создаётся', async (devUser) => {
    process.env.NODE_ENV = 'test';
    const { service, upsert } = makeService();
    expect(await statusOf(service.loginDev(devUser as never))).toBe(400);
    expect(upsert).not.toHaveBeenCalled();
  });

  it.each([['development'], ['test']])('NODE_ENV=%s — тестовый менеджер входит', async (nodeEnv) => {
    process.env.NODE_ENV = nodeEnv;
    const { service } = makeService();
    const res = await service.loginDev('manager');
    expect(res.role).toBe('MANAGER');
    expect(res.user.telegramId).toBe('100000002');
  });
});
