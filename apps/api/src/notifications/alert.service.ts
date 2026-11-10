import { Inject, Injectable, Logger } from '@nestjs/common';
import { NOTIFIER, type Notifier } from './notifier';

/** Алерт в чат ADMIN_ALERT_CHAT_ID (ошибки оплаты, падение задач). Без чата — только лог. Сам никогда не бросает. */
@Injectable()
export class AlertService {
  private readonly log = new Logger('Alert');

  constructor(@Inject(NOTIFIER) private readonly notifier: Notifier) {}

  async alert(text: string): Promise<void> {
    this.log.error(text);
    const chat = process.env.ADMIN_ALERT_CHAT_ID;
    if (!chat) return;
    try {
      await this.notifier.send(chat, 'bot.alert', { lang: 'ru', text });
    } catch (e) {
      this.log.error(`Алерт не отправлен: ${(e as Error).message}`);
    }
  }
}
