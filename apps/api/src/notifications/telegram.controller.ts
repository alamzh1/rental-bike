import { timingSafeEqual } from 'node:crypto';
import { Body, Controller, Headers, HttpCode, Inject, Post } from '@nestjs/common';
import type { Update } from 'grammy/types';
import { unauthorized } from '../auth/api-errors';
import { GrammyNotifier } from './grammy-notifier';
import { NOTIFIER, type Notifier } from './notifier';

function sameSecret(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** POST /telegram/webhook — приём обновлений бота в prod; секрет — заголовок X-Telegram-Bot-Api-Secret-Token (TELEGRAM_WEBHOOK_SECRET). */
@Controller('telegram')
export class TelegramController {
  constructor(@Inject(NOTIFIER) private readonly notifier: Notifier) {}

  @Post('webhook')
  @HttpCode(200)
  async webhook(@Headers('x-telegram-bot-api-secret-token') secret: string | undefined, @Body() update: Update): Promise<{ ok: true }> {
    const expected = process.env.TELEGRAM_WEBHOOK_SECRET;
    if (!(this.notifier instanceof GrammyNotifier) || !expected || !secret || !sameSecret(secret, expected)) throw unauthorized('Invalid webhook secret');
    await this.notifier.bot.handleUpdate(update);
    return { ok: true };
  }
}
