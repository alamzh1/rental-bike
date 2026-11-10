import type { Currency, Lang, Role } from '@rental/shared';

/** Пользователь запроса — кладётся в request.user гардами, достаётся через @CurrentUser(). */
export interface AuthUser {
  id: string;
  telegramId: string;
  role: Role;
  lang: Lang;
  currency: Currency;
}

export interface JwtPayload {
  sub: string;
  tid: string;
}

export const SESSION_TTL_SEC = 24 * 60 * 60;
