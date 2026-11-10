import { Logger } from '@nestjs/common';
import { initI18n } from '@rental/i18n';
import type { Lang } from '@rental/shared';

/** Кнопка под сообщением: открывает Mini App с `startapp` (например `booking_<id>`). */
export interface NotifierButton {
  textKey: string;
  startapp: string;
}

/** Служебный параметр `lang` задаёт язык получателя; остальные подставляются в текст ключа. */
export type NotifierParams = { lang?: Lang } & Record<string, unknown>;

export interface Notifier {
  send(telegramId: string, key: string, params: NotifierParams, button?: NotifierButton): Promise<void>;
}

export const NOTIFIER = Symbol('NOTIFIER');

const cache = new Map<Lang, ReturnType<typeof initI18n>>();

/** Текст сообщения бота по ключу `bot.*` на языке `params.lang` (фолбэк EN). */
export function renderBotText(key: string, params: NotifierParams = {}): string {
  const lang = params.lang ?? 'en';
  let t = cache.get(lang);
  if (!t) cache.set(lang, (t = initI18n(lang)));
  return t.t(key, params as Record<string, unknown>);
}

export interface SentMessage {
  telegramId: string;
  key: string;
  params: NotifierParams;
  button?: NotifierButton;
  text: string;
  buttonText?: string;
}

/** Без TELEGRAM_BOT_TOKEN: сообщения пишутся в лог и в `sent` (для тестов). */
export class LogNotifier implements Notifier {
  private readonly log = new Logger('LogNotifier');
  readonly sent: SentMessage[] = [];

  async send(telegramId: string, key: string, params: NotifierParams, button?: NotifierButton): Promise<void> {
    const text = renderBotText(key, params);
    const buttonText = button ? renderBotText(button.textKey, params) : undefined;
    this.sent.push({ telegramId, key, params, button, text, buttonText });
    if (this.sent.length > 500) this.sent.shift();
    this.log.log(`-> ${telegramId} [${key}]${button ? ` [${button.startapp}]` : ''}: ${text.replace(/\n/g, ' | ')}`);
  }
}
