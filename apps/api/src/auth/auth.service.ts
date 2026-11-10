import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { User } from '@prisma/client';
import { detectLang } from '@rental/i18n';
import type { AuthResponse, Currency, DevUser, Lang, MeUser, Role, UpdateMeRequest } from '@rental/shared';
import { PrismaService } from '../prisma/prisma.service';
import { loadSettings } from '../pricing/settings';
import { badRequest, unauthorized } from './api-errors';
import { InitDataError, verifyInitData, type TelegramUser } from './init-data';
import { SESSION_TTL_SEC, type AuthUser, type JwtPayload } from './auth.types';

// Тестовые пользователи DEV_AUTH=1 — те же Telegram ID, что в prisma/seed.ts
const DEV_USERS: Record<DevUser, { telegramId: string; role: Role; firstName: string; lastName: string }> = {
  client: { telegramId: '100000001', role: 'CLIENT', firstName: 'Test', lastName: 'Client' },
  manager: { telegramId: '100000002', role: 'MANAGER', firstName: 'Test', lastName: 'Manager' },
  owner: { telegramId: '100000004', role: 'OWNER', firstName: 'Test', lastName: 'Owner' },
  admin: { telegramId: '100000003', role: 'ADMIN', firstName: 'Test', lastName: 'Admin' },
};

const LANGS: Lang[] = ['ru', 'en', 'vi'];
const CURRENCIES: Currency[] = ['VND', 'RUB', 'USD'];
const LICENSES = ['A1', 'A', 'NONE'] as const;
const E164 = /^\+[1-9]\d{6,14}$/;

/** Вход тестовым пользователем: только явный NODE_ENV=development|test и DEV_AUTH=1 (как adminDevAuthEnabled). Пустой NODE_ENV — закрыто. */
export function devAuthEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.DEV_AUTH === '1' && (env.NODE_ENV === 'development' || env.NODE_ENV === 'test');
}

function isDevUser(value: unknown): value is DevUser {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(DEV_USERS, value);
}

function adminTelegramIds(): Set<string> {
  return new Set((process.env.ADMIN_TELEGRAM_IDS ?? '').split(',').map((s) => s.trim()).filter(Boolean));
}

function jwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is not set');
  return secret;
}

@Injectable()
export class AuthService {
  private readonly langListeners: ((u: Pick<User, 'telegramId' | 'lang' | 'role'>) => void)[] = [];

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  /** Пользователь сменил язык: бот обновляет кнопки в чате (сам модуль бота зависит от этого). */
  onLangChanged(listener: (u: Pick<User, 'telegramId' | 'lang' | 'role'>) => void): void {
    this.langListeners.push(listener);
  }

  /** Роль по Telegram ID: ADMIN_TELEGRAM_IDS (из .env) имеет приоритет над ролью в БД. */
  roleOf(user: Pick<User, 'telegramId' | 'role'>): Role {
    return adminTelegramIds().has(user.telegramId) ? 'ADMIN' : user.role;
  }

  toMe(user: User): MeUser {
    return {
      id: user.id,
      telegramId: user.telegramId,
      firstName: user.firstName,
      lastName: user.lastName,
      username: user.username,
      photoUrl: user.photoUrl,
      phone: user.phone,
      lang: user.lang,
      currency: user.currency,
      role: this.roleOf(user),
      licenseCategory: user.licenseCategory,
      verificationStatus: user.verificationStatus,
      onboarded: user.onboardedAt !== null,
      langChosen: user.langChosenAt !== null,
    };
  }

  private toAuthUser(user: User): AuthUser {
    return { id: user.id, telegramId: user.telegramId, role: this.roleOf(user), lang: user.lang, currency: user.currency };
  }

  private verify(initData: string): { tg: TelegramUser; startParam: string | null } {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) throw unauthorized('Telegram login is not configured');
    try {
      const r = verifyInitData(initData, token);
      return { tg: r.user, startParam: r.startParam };
    } catch (e) {
      if (e instanceof InitDataError) throw unauthorized(`Invalid initData: ${e.reason}`);
      throw e;
    }
  }

  private async upsertTelegramUser(tg: TelegramUser): Promise<User> {
    const profile = { firstName: tg.firstName, lastName: tg.lastName, username: tg.username, photoUrl: tg.photoUrl };
    const existing = await this.prisma.user.findUnique({ where: { telegramId: tg.id } });
    // Подпись Telegram — настоящий аккаунт: роль тестового пользователя с таким же ID ему не достаётся
    if (existing) return this.prisma.user.update({ where: { id: existing.id }, data: { ...profile, ...(existing.isDemo ? { isDemo: false, role: 'CLIENT' as const } : {}) } });
    const lang = detectLang(tg.languageCode ?? undefined);
    const { defaultCurrencyByLang } = await loadSettings(this.prisma, ['defaultCurrencyByLang']);
    return this.prisma.user.upsert({
      where: { telegramId: tg.id },
      create: { telegramId: tg.id, ...profile, lang, currency: defaultCurrencyByLang[lang] },
      update: profile,
    });
  }

  private session(user: User, startParam: string | null): AuthResponse {
    const payload: JwtPayload = { sub: user.id, tid: user.telegramId };
    const token = this.jwt.sign(payload, { secret: jwtSecret(), expiresIn: SESSION_TTL_SEC });
    const me = this.toMe(user);
    return { token, expiresAt: new Date(Date.now() + SESSION_TTL_SEC * 1000).toISOString(), user: me, role: me.role, startParam };
  }

  /** POST /auth/telegram: проверка подписи initData → пользователь (создаётся при первом входе) → JWT на 24 ч. */
  async loginTelegram(initData: string): Promise<AuthResponse> {
    const { tg, startParam } = this.verify(initData);
    return this.session(await this.upsertTelegramUser(tg), startParam);
  }

  /** DEV_AUTH=1: вход тестовым пользователем без Telegram. В production выключено. */
  async loginDev(devUser: DevUser): Promise<AuthResponse> {
    if (!devAuthEnabled()) throw unauthorized('Dev auth is disabled');
    if (!isDevUser(devUser)) throw badRequest('devUser must be client, manager or admin');
    const spec = DEV_USERS[devUser];
    const { telegramId, ...rest } = spec;
    const user = await this.prisma.user.upsert({ where: { telegramId }, create: { telegramId, ...rest, lang: 'ru', currency: 'RUB', isDemo: true }, update: {} });
    return this.session(user, null);
  }

  async userFromToken(token: string): Promise<AuthUser> {
    let payload: JwtPayload;
    try {
      payload = this.jwt.verify<JwtPayload>(token, { secret: jwtSecret() });
    } catch {
      throw unauthorized('Invalid or expired session');
    }
    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || user.telegramId !== payload.tid) throw unauthorized('Invalid or expired session');
    return this.toAuthUser(user);
  }

  /** `Authorization: tma <initData>` — проверка подписи на запросе, без JWT. */
  async userFromInitData(initData: string): Promise<AuthUser> {
    const { tg } = this.verify(initData);
    return this.toAuthUser(await this.upsertTelegramUser(tg));
  }

  async me(userId: string): Promise<MeUser> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw unauthorized();
    return this.toMe(user);
  }

  async updateMe(userId: string, body: unknown): Promise<MeUser> {
    const patch = parseUpdateMe(body);
    const data: Record<string, unknown> = {};
    if (patch.lang !== undefined) {
      data.lang = patch.lang;
      data.langChosenAt = new Date();
    }
    if (patch.currency !== undefined) data.currency = patch.currency;
    if (patch.phone !== undefined) data.phone = patch.phone;
    if (patch.licenseCategory !== undefined) data.licenseCategory = patch.licenseCategory;
    if (patch.onboarded !== undefined) {
      const current = await this.prisma.user.findUnique({ where: { id: userId }, select: { onboardedAt: true } });
      data.onboardedAt = patch.onboarded ? (current?.onboardedAt ?? new Date()) : null;
    }
    const before = patch.lang === undefined ? null : await this.prisma.user.findUnique({ where: { id: userId }, select: { lang: true } });
    const user = await this.prisma.user.update({ where: { id: userId }, data });
    if (before && before.lang !== user.lang) for (const listener of this.langListeners) listener(user);
    return this.toMe(user);
  }
}

export function parseUpdateMe(body: unknown): UpdateMeRequest {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw badRequest('Body must be an object');
  const b = body as Record<string, unknown>;
  const out: UpdateMeRequest = {};
  if (b.lang !== undefined) {
    if (!LANGS.includes(b.lang as Lang)) throw badRequest('lang must be ru, en or vi');
    out.lang = b.lang as Lang;
  }
  if (b.currency !== undefined) {
    if (!CURRENCIES.includes(b.currency as Currency)) throw badRequest('currency must be VND, RUB or USD');
    out.currency = b.currency as Currency;
  }
  if (b.phone !== undefined) {
    if (b.phone !== null && (typeof b.phone !== 'string' || !E164.test(b.phone))) throw badRequest('phone must be E.164');
    out.phone = b.phone as string | null;
  }
  if (b.licenseCategory !== undefined) {
    if (b.licenseCategory !== null && !LICENSES.includes(b.licenseCategory as (typeof LICENSES)[number])) throw badRequest('licenseCategory must be A1, A or NONE');
    out.licenseCategory = b.licenseCategory as UpdateMeRequest['licenseCategory'];
  }
  if (b.onboarded !== undefined) {
    if (typeof b.onboarded !== 'boolean') throw badRequest('onboarded must be boolean');
    out.onboarded = b.onboarded;
  }
  return out;
}
