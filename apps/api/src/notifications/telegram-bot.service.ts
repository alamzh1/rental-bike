import { Inject, Injectable, Logger, type OnApplicationBootstrap, type OnModuleDestroy } from '@nestjs/common';
import type { Lang } from '@rental/shared';
import { AuthService } from '../auth/auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { AdminLoginLinks } from './admin-login-links';
import { BotBookingsService } from './bot-bookings.service';
import { GrammyNotifier } from './grammy-notifier';
import { NOTIFIER, type Notifier } from './notifier';

/** Жизненный цикл бота: запуск приёма сообщений (/start, подсказка) и остановка. Без токена ничего не делает. */
@Injectable()
export class TelegramBotService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly log = new Logger('TelegramBot');

  constructor(
    @Inject(NOTIFIER) private readonly notifier: Notifier,
    private readonly prisma: PrismaService,
    private readonly bookings: BotBookingsService,
    private readonly loginLinks: AdminLoginLinks,
    private readonly auth: AuthService,
  ) {}

  private adminIds(): string[] {
    return (process.env.ADMIN_TELEGRAM_IDS ?? '').split(',').map((v) => v.trim()).filter(Boolean);
  }

  private async isStaff(telegramId: string): Promise<boolean> {
    if (this.adminIds().includes(telegramId)) return true;
    const user = await this.prisma.user.findUnique({ where: { telegramId }, select: { role: true } });
    return user?.role === 'ADMIN' || user?.role === 'OWNER' || user?.role === 'MANAGER';
  }

  /** Выбранный язык важнее языка Telegram. Пока не выбран, язык Telegram запоминается: сотруднику, которого завели заранее, он ещё неизвестен. */
  private async langFor(telegramId: string, telegramLang: Lang): Promise<Lang> {
    const user = await this.prisma.user.findUnique({ where: { telegramId }, select: { id: true, lang: true, langChosenAt: true } });
    if (!user) return telegramLang;
    if (user.langChosenAt) return user.lang;
    if (user.lang !== telegramLang) await this.prisma.user.update({ where: { id: user.id }, data: { lang: telegramLang } });
    return telegramLang;
  }

  /** При старте: кнопка «Админка» у всех сотрудников. Кто ещё не писал боту, получит её после /start. */
  private async syncStaffMenus(notifier: GrammyNotifier): Promise<void> {
    const rows = await this.prisma.user.findMany({ where: { OR: [{ role: { in: ['ADMIN', 'OWNER', 'MANAGER'] } }, { telegramId: { in: this.adminIds() } }] }, select: { telegramId: true, lang: true } });
    const known = new Set(rows.map((r) => r.telegramId));
    const all = [...rows, ...this.adminIds().filter((id) => !known.has(id)).map((telegramId) => ({ telegramId, lang: 'ru' as const }))];
    for (const u of all) if (/^\d+$/.test(u.telegramId)) await notifier.syncMenu(Number(u.telegramId), true, u.lang);
  }

  async onApplicationBootstrap(): Promise<void> {
    if (!(this.notifier instanceof GrammyNotifier)) return;
    this.notifier.setStaffCheck((id) => this.isStaff(id));
    this.notifier.setLoginLinks(this.loginLinks);
    this.notifier.setSessionRevoker(async (telegramId) => {
      await this.prisma.user.updateMany({ where: { telegramId }, data: { adminSessionsAfter: new Date() } });
    });
    this.notifier.setBookingsReply((id, kind, lang) => this.bookings.reply(id, kind, lang));
    this.notifier.setLangSource((id, lang) => this.langFor(id, lang));
    const notifier = this.notifier;
    this.auth.onLangChanged((u) => void notifier.languageChanged(u.telegramId, this.auth.roleOf(u) !== 'CLIENT', u.lang));
    try {
      await this.notifier.start();
      await this.syncStaffMenus(this.notifier);
    } catch (e) {
      this.log.error(`Бот не запущен: ${(e as Error).message}`);
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.notifier instanceof GrammyNotifier) await this.notifier.stop().catch(() => undefined);
  }
}
