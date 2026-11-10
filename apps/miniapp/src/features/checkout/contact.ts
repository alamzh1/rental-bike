import { requestContact } from '@telegram-apps/sdk-react';

export type ContactResult = { status: 'unavailable' | 'cancelled' } | { status: 'sent'; phone: string | null };

/**
 * Запрос контакта через Telegram. Отказ или клиент без поддержки → ручной ввод.
 * Telegram отдаёт номер боту; если Mini App его не получил, возвращаем phone: null и просим ввести вручную.
 */
export async function requestTelegramContact(): Promise<ContactResult> {
  if (!requestContact.isAvailable()) return { status: 'unavailable' };
  try {
    const raw = (await requestContact()).contact?.phone_number;
    return { status: 'sent', phone: raw ? (raw.startsWith('+') ? raw : `+${raw}`) : null };
  } catch {
    return { status: 'cancelled' };
  }
}
