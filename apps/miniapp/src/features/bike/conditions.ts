import { pickText } from '@rental/i18n';
import type { I18nText, Lang } from '@rental/shared';

/** Требуемые документы из брифа: паспорт, права, международное водительское (Венская конвенция 1968). Категорию берём из модели. */
export const REQUIRED_DOCUMENTS = ['passport', 'license', 'idp'] as const;

export type ConditionsView = { kind: 'text'; text: string } | { kind: 'placeholder' };

/** Ограничения (пробег, поездки между провинциями) приходят из настроек; не заданы — видимая заглушка, не выдуманный текст. */
export function conditionsView(conditions: I18nText | null | undefined, lang: Lang | string): ConditionsView {
  if (!conditions) return { kind: 'placeholder' };
  const text = pickText(conditions, lang as Lang).trim();
  return text ? { kind: 'text', text } : { kind: 'placeholder' };
}
