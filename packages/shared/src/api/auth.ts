// Типы API модуля `auth`: вход по initData Telegram, сессия JWT, профиль (PATCH /me).
import type { Currency, Lang, Role } from '../types.js';

export type LicenseCategory = 'A1' | 'A' | 'NONE';
export type VerificationStatus = 'NONE' | 'PENDING' | 'VERIFIED' | 'REJECTED';

/** Тестовые пользователи для DEV_AUTH=1 (не в production). */
export type DevUser = 'client' | 'manager' | 'owner' | 'admin';

/** POST /auth/telegram: `initData` — строка Telegram.WebApp.initData; в dev вместо неё можно `devUser`. */
export interface AuthTelegramRequest {
  initData?: string;
  devUser?: DevUser;
}

export interface MeUser {
  id: string;
  telegramId: string;
  firstName: string | null;
  lastName: string | null;
  username: string | null;
  photoUrl: string | null;
  phone: string | null;
  lang: Lang;
  currency: Currency;
  role: Role;
  licenseCategory: LicenseCategory | null;
  verificationStatus: VerificationStatus;
  onboarded: boolean;
  /** Клиент сам выбрал язык; false — сначала экран выбора языка */
  langChosen: boolean;
}

/** Ответ POST /auth/telegram. `token` — JWT на 24 ч: дальше `Authorization: Bearer <token>`. */
export interface AuthResponse {
  token: string;
  expiresAt: string;
  user: MeUser;
  role: Role;
  /** start_param из initData (deeplink `startapp`), если был */
  startParam: string | null;
}

/** PATCH /me — все поля необязательны. `phone` — E.164 (+84…); null стирает. */
export interface UpdateMeRequest {
  lang?: Lang;
  currency?: Currency;
  phone?: string | null;
  licenseCategory?: LicenseCategory | null;
  onboarded?: boolean;
}
