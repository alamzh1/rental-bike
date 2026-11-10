import { detectLang } from '@rental/i18n';
import type { Currency, Lang, Role } from '@rental/shared';
import type { AuthResponse, MePatch, SessionUser } from './types';

// Мок авторизации до таска 04 — тот же контракт, что у POST /api/auth/telegram и PATCH /api/me.
// Работает только при DEV_AUTH=1; состояние (язык, онбординг) хранится в localStorage браузера.

const DEFAULT_CURRENCY: Record<Lang, Currency> = { ru: 'RUB', en: 'USD', vi: 'VND' };
const key = (telegramId: string) => `rental.mock-user.${telegramId}`;

interface TelegramUserJson {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  photo_url?: string;
}

function readStored(telegramId: string): Partial<SessionUser> {
  try {
    return JSON.parse(globalThis.localStorage?.getItem(key(telegramId)) ?? '{}') as Partial<SessionUser>;
  } catch {
    return {};
  }
}

function store(user: SessionUser): void {
  try {
    globalThis.localStorage?.setItem(key(user.telegramId), JSON.stringify({ lang: user.lang, currency: user.currency, onboarded: user.onboarded, phone: user.phone }));
  } catch {
    // приватный режим — состояние живёт до перезагрузки
  }
}

export function mockAuth(initData: string, role: Role = 'CLIENT'): AuthResponse {
  const raw = new URLSearchParams(initData).get('user');
  const tg = (raw ? JSON.parse(raw) : { id: 0 }) as TelegramUserJson;
  const telegramId = String(tg.id);
  const lang = detectLang(tg.language_code);
  const user: SessionUser = {
    id: `mock-${telegramId}`,
    telegramId,
    firstName: tg.first_name ?? null,
    lastName: tg.last_name ?? null,
    username: tg.username ?? null,
    photoUrl: tg.photo_url ?? null,
    phone: null,
    lang,
    currency: DEFAULT_CURRENCY[lang],
    licenseCategory: null,
    verificationStatus: 'NONE',
    onboarded: false,
    langChosen: false,
    ...readStored(telegramId),
    role,
  };
  return { token: `mock.${telegramId}.${role}`, expiresAt: new Date(Date.now() + 86_400_000).toISOString(), user, role, startParam: null };
}

export function mockUpdateMe(user: SessionUser, patch: MePatch): SessionUser {
  const next: SessionUser = { ...user, ...patch, onboarded: patch.onboarded ?? user.onboarded, langChosen: patch.lang ? true : user.langChosen };
  store(next);
  return next;
}
