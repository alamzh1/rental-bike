import { Module } from '@nestjs/common';
import { BookingsModule } from '../bookings/bookings.module';
import { BotBookingsService } from './bot-bookings.service';
import { RatesModule } from '../rates/rates.module';
import { AdminLoginLinks } from './admin-login-links';
import { AlertService } from './alert.service';
import { GrammyNotifier } from './grammy-notifier';
import { LogNotifier, NOTIFIER, type Notifier } from './notifier';
import { NotificationsService } from './notifications.service';
import { TelegramBotService } from './telegram-bot.service';
import { TelegramController } from './telegram.controller';

/** Бот (grammY) при заданном TELEGRAM_BOT_TOKEN, иначе LogNotifier. В тестах (VITEST) бот не поднимается. */
export function createNotifier(env: NodeJS.ProcessEnv = process.env): Notifier {
  const token = env.TELEGRAM_BOT_TOKEN;
  return token && !env.VITEST ? new GrammyNotifier(token, env) : new LogNotifier();
}

// Уведомления: подписка на BookingEvents, напоминания и сводка через JobsService, алерты в ADMIN_ALERT_CHAT_ID.
@Module({
  imports: [BookingsModule, RatesModule],
  controllers: [TelegramController],
  providers: [{ provide: NOTIFIER, useFactory: () => createNotifier() }, NotificationsService, AlertService, TelegramBotService, BotBookingsService, AdminLoginLinks],
  exports: [NOTIFIER, NotificationsService, AlertService, AdminLoginLinks],
})
export class NotificationsModule {}
