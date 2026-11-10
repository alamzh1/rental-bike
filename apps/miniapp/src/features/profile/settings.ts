import { useQuery } from '@tanstack/react-query';
import type { Currency, I18nText } from '@rental/shared';
import { useApp } from '@/app/context';

/**
 * Публичные настройки для клиента (FAQ, правила, политика, контакт менеджера, курсы).
 * Эндпоинта в API пока нет (T04/T05 его не выставили): запрос тихо падает, экраны показывают
 * заглушку «впиши в админке», а не выдуманный текст. Ожидаемый формат — GET /settings/public.
 */
export interface PublicSettings {
  faq?: I18nText | null;
  rulesText?: I18nText | null;
  privacyText?: I18nText | null;
  /** @username, ссылка t.me/… или телефон */
  managerContact?: string | null;
  /** Предоплата наличной брони, % */
  cashPrepayPercent?: number | null;
  /** Единиц валюты за 1 VND */
  rates?: Partial<Record<'RUB' | 'USD', number>> | null;
  /** Перевод в рублях включён: ₽ за 1 ₫ с наценкой */
  rubTransfer?: { rubPerVnd: number } | null;
}

export function usePublicSettings() {
  const { api } = useApp();
  return useQuery({
    queryKey: ['settings-public'],
    queryFn: () => api.request<PublicSettings>('/settings/public'),
    retry: false,
    staleTime: 5 * 60_000,
  });
}

/** Валюта показа цен из профиля и курс из настроек; без курса пересчёта «≈» нет. */
export function useDisplayCurrency(): { currency: Currency; rate: number } | undefined {
  const { user } = useApp();
  const { data } = usePublicSettings();
  if (user.currency === 'VND') return undefined;
  const rate = data?.rates?.[user.currency];
  return rate ? { currency: user.currency, rate } : undefined;
}

/** Ссылка для «Связаться с менеджером»: @user → t.me, http(s) как есть, остальное — телефон. */
export function contactHref(contact: string | null | undefined): string | null {
  const c = contact?.trim();
  if (!c) return null;
  if (/^https?:\/\//i.test(c)) return c;
  if (c.startsWith('@')) return `https://t.me/${c.slice(1)}`;
  if (/^[+\d][\d\s()-]{5,}$/.test(c)) return `tel:${c.replace(/[\s()-]/g, '')}`;
  return `https://t.me/${c}`;
}
