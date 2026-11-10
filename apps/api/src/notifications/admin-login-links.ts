import { createHash, randomBytes } from 'node:crypto';
import { HttpStatus, Injectable } from '@nestjs/common';
import type { Lang } from '@rental/shared';
import { apiError } from '../bookings/errors';
import { Clock } from '../jobs/clock';

// Вход в админку через бота, без номера телефона: браузер получает ссылку на бота и секрет, сотрудник подтверждает вход
// в чате, браузер по секрету забирает сессию. Код виден Telegram, секрет — только браузеру: перехват ссылки входа не даёт.
// Заявки живут в памяти: перезапуск API лишь заставит обновить страницу входа.

const TTL_MS = 5 * 60_000;
const MAX_PENDING = 2_000;
/** С одного адреса: перебор заявок не должен закрывать вход остальным. */
const MAX_PER_IP = 20;

export interface LoginLinkUser {
  id: string;
  firstName: string | null;
  lastName: string | null;
  username: string | null;
  photoUrl: string | null;
}

/** Откуда открыта страница входа: сотрудник сверяет это в боте, поддельная страница покажет чужой адрес. */
export interface LoginLinkOrigin {
  ip: string;
  country: string | null;
  device: string;
  /** Язык, выбранный на странице входа: на нём бот просит подтвердить вход */
  lang?: Lang;
}

export type LoginLinkState = { status: 'pending' } | { status: 'expired' } | { status: 'denied' } | { status: 'confirmed'; user: LoginLinkUser; origin: LoginLinkOrigin };

/** Браузер и система из User-Agent: подсказка для человека, не проверка. */
export function describeDevice(ua: string | undefined): string {
  const u = ua ?? '';
  const browser = /Edg\//.test(u) ? 'Edge' : /OPR\//.test(u) ? 'Opera' : /Firefox\//.test(u) ? 'Firefox' : /Chrome\//.test(u) ? 'Chrome' : /Safari\//.test(u) ? 'Safari' : '';
  const os = /iPhone|iPad/.test(u) ? 'iOS' : /Android/.test(u) ? 'Android' : /Mac OS X/.test(u) ? 'Mac' : /Windows/.test(u) ? 'Windows' : /Linux/.test(u) ? 'Linux' : '';
  return [browser, os].filter(Boolean).join(', ') || '?';
}

interface Link {
  code: string;
  secretHash: string;
  expiresAt: number;
  denied: boolean;
  user: LoginLinkUser | null;
  origin: LoginLinkOrigin;
}

const hash = (s: string) => createHash('sha256').update(s).digest('hex');

@Injectable()
export class AdminLoginLinks {
  private readonly byCode = new Map<string, Link>();
  private readonly bySecret = new Map<string, Link>();

  constructor(private readonly clock: Clock) {}

  private purge(now: number): void {
    for (const l of this.byCode.values()) {
      if (l.expiresAt <= now) this.remove(l);
    }
  }

  private remove(l: Link): void {
    this.byCode.delete(l.code);
    this.bySecret.delete(l.secretHash);
  }

  create(origin: LoginLinkOrigin): { code: string; secret: string; expiresAt: Date } {
    const now = this.clock.now().getTime();
    this.purge(now);
    const fromIp = [...this.byCode.values()].filter((l) => l.origin.ip === origin.ip).length;
    if (fromIp >= MAX_PER_IP || this.byCode.size >= MAX_PENDING) throw apiError(HttpStatus.TOO_MANY_REQUESTS, 'RATE_LIMITED', 'Too many login attempts');
    const code = randomBytes(16).toString('base64url');
    const secret = randomBytes(32).toString('base64url');
    const link: Link = { code, secretHash: hash(secret), expiresAt: now + TTL_MS, denied: false, user: null, origin };
    this.byCode.set(code, link);
    this.bySecret.set(link.secretHash, link);
    return { code, secret, expiresAt: new Date(link.expiresAt) };
  }

  private live(code: string): Link | null {
    const l = this.byCode.get(code);
    if (!l) return null;
    if (l.expiresAt <= this.clock.now().getTime()) {
      this.remove(l);
      return null;
    }
    return l;
  }

  isLive(code: string): boolean {
    const l = this.live(code);
    return !!l && !l.user && !l.denied;
  }

  origin(code: string): LoginLinkOrigin | null {
    return this.live(code)?.origin ?? null;
  }

  confirm(code: string, user: LoginLinkUser): boolean {
    const l = this.live(code);
    if (!l || l.user || l.denied) return false;
    l.user = user;
    return true;
  }

  deny(code: string): void {
    const l = this.live(code);
    if (l && !l.user) l.denied = true;
  }

  /** Подтверждённая заявка выдаётся один раз: повторный запрос с тем же секретом сессию не получит. */
  take(secret: string): LoginLinkState {
    const l = this.bySecret.get(hash(secret));
    if (!l || l.expiresAt <= this.clock.now().getTime()) {
      if (l) this.remove(l);
      return { status: 'expired' };
    }
    if (l.denied) {
      this.remove(l);
      return { status: 'denied' };
    }
    if (!l.user) return { status: 'pending' };
    this.remove(l);
    return { status: 'confirmed', user: l.user, origin: l.origin };
  }
}
