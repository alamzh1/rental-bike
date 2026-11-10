import { Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { User } from '@prisma/client';
import { ADMIN_LOCATION_HEADER, ADMIN_SECTIONS, canOpenSection, type AdminLoginLink, type AdminMe, type AdminSessionResponse, type StaffRole } from '@rental/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthService } from '../../auth/auth.service';
import { AdminLoginLinks, type LoginLinkOrigin } from '../../notifications/admin-login-links';
import { NOTIFIER, type Notifier } from '../../notifications/notifier';
import { forbidden, notFound, unauthorized, badRequest } from '../../auth/api-errors';
import type { AuthUser } from '../../auth/auth.types';
import { InitDataError, verifyInitData } from '../../auth/init-data';
import { LoginWidgetError, verifyLoginWidget } from './login-widget';

// Сессия веб-админки: подпись Login Widget → JWT (ADMIN_SESSION_SECRET) в cookie httpOnly `admin_session`.
// Роль и точка читаются из БД на каждый запрос — снятие роли действует сразу.

export const ADMIN_COOKIE = 'admin_session';
export const ADMIN_SESSION_TTL_SEC = 12 * 60 * 60;
const AUDIENCE = 'admin';

/** Пользователь запроса админки: AuthUser + точка сотрудника (у администратора — выбранная в интерфейсе). */
export interface AdminUser extends AuthUser {
  role: StaffRole;
  locationId: string | null;
  name: string;
}

interface AdminJwt {
  sub: string;
  tid: string;
  aud: string;
  iat?: number;
}

// Тестовые сотрудники dev-входа — те же Telegram ID, что в prisma/seed.ts
const DEV_STAFF = {
  manager: { telegramId: '100000002', role: 'MANAGER' as const, firstName: 'Test', lastName: 'Manager' },
  owner: { telegramId: '100000004', role: 'OWNER' as const, firstName: 'Test', lastName: 'Owner' },
  admin: { telegramId: '100000003', role: 'ADMIN' as const, firstName: 'Test', lastName: 'Admin' },
};

/** Dev-вход: только явный NODE_ENV=development|test и DEV_AUTH=1. Пустой NODE_ENV — закрыто. */
export function adminDevAuthEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.DEV_AUTH === '1' && (env.NODE_ENV === 'development' || env.NODE_ENV === 'test');
}

/**
 * DEV_AUTH=local: кнопки тестового входа только для браузера на этой машине — вход с адреса туннеля закрыт.
 * Прямой запрос с loopback без заголовков прокси и с локальным Origin; туннель всегда добавляет свои заголовки.
 */
export function adminLocalDevAuth(req: { socket?: { remoteAddress?: string }; headers: Record<string, string | string[] | undefined> }, env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.DEV_AUTH !== 'local' || (env.NODE_ENV !== 'development' && env.NODE_ENV !== 'test')) return false;
  const remote = req.socket?.remoteAddress ?? '';
  if (remote !== '127.0.0.1' && remote !== '::1' && remote !== '::ffff:127.0.0.1') return false;
  if (['x-forwarded-for', 'x-forwarded-host', 'forwarded', 'x-real-ip', 'cf-connecting-ip'].some((h) => req.headers[h] !== undefined)) return false;
  const origin = req.headers.origin;
  if (origin === undefined) return true;
  try {
    return ['localhost', '127.0.0.1'].includes(new URL(String(origin)).hostname);
  } catch {
    return false;
  }
}

function secret(): string {
  const s = process.env.ADMIN_SESSION_SECRET;
  if (!s) throw new Error('ADMIN_SESSION_SECRET is not set');
  return s;
}

export function displayName(u: Pick<User, 'firstName' | 'lastName' | 'username' | 'telegramId'>): string {
  const name = [u.firstName, u.lastName].filter(Boolean).join(' ').trim();
  return name || (u.username ? `@${u.username}` : u.telegramId);
}

/** Значение cookie из заголовка Cookie (без зависимости cookie-parser). */
/** Токен сессии: cookie браузера или Authorization: Bearer (админка во фрейме Telegram). */
export function sessionToken(headers: Record<string, string | string[] | undefined>): string | null {
  const cookie = readCookie(headers.cookie, ADMIN_COOKIE);
  if (cookie) return cookie;
  const auth = headers.authorization;
  return typeof auth === 'string' && auth.startsWith('Bearer ') ? auth.slice(7) : null;
}

/** Точка, выбранная администратором в интерфейсе. Заголовок только сужает обзор: роли и права не меняет. */
export function actingLocation(headers: Record<string, string | string[] | undefined>): string | null {
  const v = headers[ADMIN_LOCATION_HEADER];
  return typeof v === 'string' && /^[\w-]{1,40}$/.test(v) ? v : null;
}

export function readCookie(header: string | string[] | undefined, name: string): string | null {
  const raw = Array.isArray(header) ? header.join('; ') : header;
  if (!raw) return null;
  for (const part of raw.split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    if (part.slice(0, i).trim() === name) {
      try {
        return decodeURIComponent(part.slice(i + 1).trim());
      } catch {
        return null;
      }
    }
  }
  return null;
}

@Injectable()
export class AdminSessionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly auth: AuthService,
    private readonly links: AdminLoginLinks,
    @Inject(NOTIFIER) private readonly notifier: Notifier,
  ) {}

  private staffRole(user: User): StaffRole | null {
    const role = this.auth.roleOf(user);
    return role === 'ADMIN' || role === 'OWNER' || role === 'MANAGER' ? role : null;
  }

  private toAdminUser(user: User, role: StaffRole): AdminUser {
    return { id: user.id, telegramId: user.telegramId, role, lang: user.lang, currency: user.currency, locationId: role === 'ADMIN' ? null : user.locationId, name: displayName(user) };
  }

  /** POST /admin/auth/telegram: подпись Login Widget → сотрудник (ADMIN_TELEGRAM_IDS или роль в БД) → сессия. */
  async loginWidget(body: unknown): Promise<{ token: string; session: AdminSessionResponse }> {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) throw unauthorized('Telegram login is not configured');
    let tg;
    try {
      tg = verifyLoginWidget(body, botToken);
    } catch (e) {
      if (e instanceof LoginWidgetError) throw unauthorized(`Invalid Login Widget data: ${e.reason}`);
      throw e;
    }
    return this.staffSession(tg);
  }

  /** POST /admin/auth/webapp: подпись initData из Telegram → сотрудник → сессия. */
  async loginWebApp(initData: string): Promise<{ token: string; session: AdminSessionResponse }> {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) throw unauthorized('Telegram login is not configured');
    try {
      return await this.staffSession(verifyInitData(initData, botToken).user);
    } catch (e) {
      if (e instanceof InitDataError) throw unauthorized(`Invalid initData: ${e.reason}`);
      throw e;
    }
  }

  /** POST /admin/auth/link: заявка на вход через бота. */
  createLoginLink(origin: LoginLinkOrigin): AdminLoginLink {
    const username = process.env.TELEGRAM_BOT_USERNAME;
    if (!username || !process.env.TELEGRAM_BOT_TOKEN) throw unauthorized('Telegram login is not configured');
    const { code, secret, expiresAt } = this.links.create(origin);
    return { url: `https://t.me/${username}?start=login_${code}`, secret, expiresAt: expiresAt.toISOString() };
  }

  /** POST /admin/auth/link/status: подтверждено в боте → сессия; роль проверяется ещё раз при выдаче. */
  async pollLoginLink(secret: string): Promise<{ status: 'pending' | 'expired' | 'denied' } | { status: 'confirmed'; token: string; session: AdminSessionResponse }> {
    const state = this.links.take(secret);
    if (state.status !== 'confirmed') return state;
    const issued = await this.staffSession(state.user);
    // Пришло, а входил не ты: значит, подтверждение выманили. В сообщении есть команда, закрывающая все сессии
    const lang = state.origin.lang ?? (await this.prisma.user.findUnique({ where: { telegramId: state.user.id }, select: { lang: true } }))?.lang ?? 'ru';
    await this.notifier.send(state.user.id, 'bot.admin.loginNotice', { lang, device: state.origin.device, ip: state.origin.ip, country: state.origin.country ?? '?' }).catch(() => undefined);
    return { status: 'confirmed', ...issued };
  }

  private async staffSession(tg: { id: string; firstName: string | null; lastName: string | null; username: string | null; photoUrl: string | null }): Promise<{ token: string; session: AdminSessionResponse }> {
    const profile = { firstName: tg.firstName, lastName: tg.lastName, username: tg.username, photoUrl: tg.photoUrl };
    let user = await this.prisma.user.findUnique({ where: { telegramId: tg.id } });
    // Подпись Telegram — настоящий аккаунт: роль тестового пользователя с таким же ID ему не достаётся
    if (user?.isDemo) user = await this.prisma.user.update({ where: { id: user.id }, data: { isDemo: false, role: 'CLIENT' } });
    // Новый пользователь заводится только для ID из ADMIN_TELEGRAM_IDS — клиенты через админку не регистрируются
    if (!user && this.auth.roleOf({ telegramId: tg.id, role: 'CLIENT' }) === 'ADMIN') {
      user = await this.prisma.user.create({ data: { telegramId: tg.id, ...profile, lang: 'ru', currency: 'VND' } });
    }
    if (!user) throw forbidden('Not a staff member');
    const role = this.staffRole(user);
    if (!role) throw forbidden('Not a staff member');
    user = await this.prisma.user.update({ where: { id: user.id }, data: profile });
    return this.issue(user, role);
  }

  /** POST /admin/auth/dev: тестовый менеджер или админ. Вне development|test — 404, как будто маршрута нет. */
  async loginDev(body: unknown, allowed = adminDevAuthEnabled()): Promise<{ token: string; session: AdminSessionResponse }> {
    if (!allowed) throw notFound();
    const key = (body as { role?: unknown } | null)?.role;
    if (key !== 'manager' && key !== 'owner' && key !== 'admin') throw badRequest('role must be manager, owner or admin');
    const { telegramId, role, ...rest } = DEV_STAFF[key];
    const user = await this.prisma.user.upsert({ where: { telegramId }, create: { telegramId, role, ...rest, lang: 'ru', currency: 'VND', isDemo: true }, update: { role } });
    return this.issue(user, this.staffRole(user) ?? role);
  }

  private async issue(user: User, role: StaffRole): Promise<{ token: string; session: AdminSessionResponse }> {
    const payload: AdminJwt = { sub: user.id, tid: user.telegramId, aud: AUDIENCE };
    const token = this.jwt.sign(payload, { secret: secret(), expiresIn: ADMIN_SESSION_TTL_SEC });
    const expiresAt = new Date(Date.now() + ADMIN_SESSION_TTL_SEC * 1000).toISOString();
    return { token, session: { me: await this.me(this.toAdminUser(user, role)), expiresAt } };
  }

  /** Сотрудник по значению cookie; нет/испорчена/истекла/роль снята → 401. */
  async resolve(token: string | null, acting: string | null = null): Promise<AdminUser> {
    if (!token) throw unauthorized();
    let payload: AdminJwt;
    try {
      payload = this.jwt.verify<AdminJwt>(token, { secret: secret(), audience: AUDIENCE });
    } catch {
      throw unauthorized('Invalid or expired session');
    }
    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || user.telegramId !== payload.tid) throw unauthorized('Invalid or expired session');
    if (user.adminSessionsAfter && (payload.iat ?? 0) < Math.floor(user.adminSessionsAfter.getTime() / 1000)) throw unauthorized('Invalid or expired session');
    const role = this.staffRole(user);
    if (!role) throw unauthorized('Staff role revoked');
    const admin = this.toAdminUser(user, role);
    return role === 'ADMIN' && acting ? { ...admin, locationId: acting } : admin;
  }

  /** Выход: все выданные ранее сессии сотрудника перестают действовать, даже если токен кем-то сохранён. */
  async revoke(token: string | null): Promise<void> {
    if (!token) return;
    const user = await this.resolve(token).catch(() => null);
    if (user) await this.prisma.user.update({ where: { id: user.id }, data: { adminSessionsAfter: new Date() } });
  }

  async me(u: AdminUser): Promise<AdminMe> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: u.id } });
    const loc = u.locationId
      ? await this.prisma.location.findUnique({ where: { id: u.locationId }, select: { timezone: true } })
      : await this.prisma.location.findFirst({ where: { isActive: true }, orderBy: { createdAt: 'asc' }, select: { timezone: true } });
    return {
      id: user.id,
      telegramId: user.telegramId,
      name: u.name,
      username: user.username,
      photoUrl: user.photoUrl,
      role: u.role,
      locationId: u.locationId,
      timezone: loc?.timezone ?? 'Asia/Ho_Chi_Minh',
      sections: ADMIN_SECTIONS.filter((s) => canOpenSection(u.role, s)),
      hasDemoData: await this.hasDemoData(u),
    };
  }

  /** В БД остались демо-значения — плашка «Демо-данные — замените». */
  async hasDemoData(u: AdminUser): Promise<boolean> {
    // Чужие демо-данные и общие настройки владельцу исправить нельзя: плашка только о его точке
    if (u.role === 'OWNER') {
      const own = { isDemo: true, locationId: u.locationId ?? '' };
      return (await this.prisma.bikeModel.count({ where: own })) + (await this.prisma.bike.count({ where: own })) > 0;
    }
    const where = { where: { isDemo: true } };
    const counts = await Promise.all([
      this.prisma.bikeModel.count(where),
      this.prisma.tariff.count(where),
      this.prisma.bike.count(where),
      this.prisma.extra.count(where),
      this.prisma.setting.count(where),
      this.prisma.location.count(where),
      this.prisma.banner.count(where),
    ]);
    return counts.some((n) => n > 0);
  }
}
