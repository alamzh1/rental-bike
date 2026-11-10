import { Logger } from '@nestjs/common';
import { Bot, GrammyError, type Api, type Context } from 'grammy';
import { detectLang } from '@rental/i18n';
import { LANGS, type Lang } from '@rental/shared';
import type { AdminLoginLinks } from './admin-login-links';
import type { BotBookingsKind, BotBookingsReply } from './bot-bookings.service';
import { renderBotText, type Notifier, type NotifierButton, type NotifierParams } from './notifier';

/** Telegram-бот на grammY. Токен — из TELEGRAM_BOT_TOKEN (значение нигде не пишется в лог). */
export class GrammyNotifier implements Notifier {
  private readonly log = new Logger('GrammyNotifier');
  readonly bot: Bot;
  private username: string | null;
  private isStaff: (telegramId: string) => Promise<boolean> = async () => false;
  private loginLinks: Pick<AdminLoginLinks, 'isLive' | 'origin' | 'confirm' | 'deny'> | null = null;
  private revokeSessions: (telegramId: string) => Promise<void> = async () => undefined;
  private storedLang: (telegramId: string, telegramLang: Lang) => Promise<Lang> = async (_id, telegramLang) => telegramLang;
  private bookingsReply: (telegramId: string, kind: BotBookingsKind, lang: Lang) => Promise<BotBookingsReply> = async (_id, kind, lang) => ({ text: renderBotText(`bot.bookings.empty.${kind}`, { lang }), open: [] });

  constructor(token: string, private readonly env: NodeJS.ProcessEnv = process.env) {
    this.bot = new Bot(token);
    this.username = env.TELEGRAM_BOT_USERNAME || null;
    this.registerHandlers();
  }

  private get miniAppUrl(): string | null {
    const url = this.env.MINIAPP_URL;
    return url?.startsWith('https://') ? url : null;
  }

  private get adminUrl(): string | null {
    const url = this.env.ADMIN_URL;
    return url?.startsWith('https://') ? url : null;
  }

  /** Как определить сотрудника: задаёт TelegramBotService (роль в БД и ADMIN_TELEGRAM_IDS). */
  setStaffCheck(check: (telegramId: string) => Promise<boolean>): void {
    this.isStaff = check;
  }

  /** Заявки на вход в админку: задаёт TelegramBotService. */
  setLoginLinks(links: Pick<AdminLoginLinks, 'isLive' | 'origin' | 'confirm' | 'deny'>): void {
    this.loginLinks = links;
  }

  /** Как отозвать все сессии админки сотрудника: задаёт TelegramBotService. */
  setSessionRevoker(revoke: (telegramId: string) => Promise<void>): void {
    this.revokeSessions = revoke;
  }

  /** Как узнать выбранный в приложении язык: задаёт TelegramBotService. */
  setLangSource(source: (telegramId: string, telegramLang: Lang) => Promise<Lang>): void {
    this.storedLang = source;
  }

  /** Язык ответа: выбранный в приложении; пока не выбран, язык Telegram. */
  private langOf(from: Context['from']): Promise<Lang> {
    const telegramLang = detectLang(from?.language_code);
    return from ? this.storedLang(String(from.id), telegramLang) : Promise.resolve(telegramLang);
  }

  /** Сотрудник пришёл по ссылке со страницы входа. Вход подтверждается отдельной кнопкой: ссылку могли прислать чужие. */
  private async promptLogin(ctx: Context, code: string, lang: Lang): Promise<void> {
    if (!this.loginLinks?.isLive(code)) {
      await ctx.reply(renderBotText('bot.admin.loginExpired', { lang }));
      return;
    }
    if (!ctx.from || !(await this.isStaff(String(ctx.from.id)))) {
      this.loginLinks.deny(code);
      await ctx.reply(renderBotText('bot.admin.denied', { lang }));
      return;
    }
    const from = this.loginLinks.origin(code);
    await ctx.reply(renderBotText('bot.admin.loginPrompt', { lang: from?.lang ?? lang, device: from?.device ?? '?', ip: from?.ip ?? '?', country: from?.country ?? '?', site: this.adminUrl ? new URL(this.adminUrl).hostname : '?' }), {
      reply_markup: {
        inline_keyboard: [
          [{ text: renderBotText('bot.admin.loginConfirm', { lang: from?.lang ?? lang }), callback_data: `login:${code}` }],
          [{ text: renderBotText('bot.admin.loginCancel', { lang: from?.lang ?? lang }), callback_data: `nologin:${code}` }],
        ],
      },
    });
  }

  /** Откуда брать ответ на кнопки броней: задаёт TelegramBotService. */
  setBookingsReply(reply: (telegramId: string, kind: BotBookingsKind, lang: Lang) => Promise<BotBookingsReply>): void {
    this.bookingsReply = reply;
  }

  /** Постоянные кнопки над полем ввода: брони и сроки всегда под рукой, в том числе у сотрудников. */
  private keyboard(lang: Lang) {
    return { keyboard: [[{ text: renderBotText('bot.bookings.my', { lang }) }, { text: renderBotText('bot.bookings.ending', { lang }) }]], resize_keyboard: true, is_persistent: true };
  }

  private async showKeyboard(ctx: Context, lang: Lang): Promise<void> {
    await ctx.reply(renderBotText('bot.bookings.hint', { lang }), { reply_markup: this.keyboard(lang) });
  }

  /** Кнопка распознаётся на любом языке: язык Telegram мог смениться после того, как она была показана. */
  private bookingsKind(text: string | undefined): BotBookingsKind | null {
    if (!text) return null;
    for (const lang of LANGS) {
      if (text === renderBotText('bot.bookings.my', { lang })) return 'my';
      if (text === renderBotText('bot.bookings.ending', { lang })) return 'ending';
    }
    return null;
  }

  private async replyBookings(ctx: Context, kind: BotBookingsKind, lang: Lang): Promise<void> {
    if (!ctx.from) return;
    const r = await this.bookingsReply(String(ctx.from.id), kind, lang);
    const rows: { text: string; url: string }[][] = [];
    for (const b of r.open) {
      const url = await this.link(b.startapp);
      if (url) rows.push([{ text: renderBotText('bot.bookings.open', { lang, code: b.code }), url }]);
    }
    await ctx.reply(r.text, { reply_markup: rows.length ? { inline_keyboard: rows } : this.keyboard(lang), link_preview_options: { is_disabled: true } });
  }

  /** Личная кнопка меню: сотруднику — админка, остальным — общая кнопка бота. Сбой не мешает ответу. */
  async syncMenu(chatId: number, staff: boolean, lang: Lang): Promise<void> {
    const url = staff ? this.adminUrl : null;
    try {
      await this.bot.api.setChatMenuButton({
        chat_id: chatId,
        menu_button: url ? { type: 'web_app', text: renderBotText('bot.admin.menu', { lang }), web_app: { url } } : { type: 'default' },
      });
    } catch (e) {
      this.log.warn(`Кнопка меню ${chatId} не обновлена: ${(e as Error).message}`);
    }
  }

  /** Язык сменили в приложении: кнопки в чате и кнопка меню остались бы на прежнем языке, а сами они не обновляются. Сбой не мешает смене. */
  async languageChanged(telegramId: string, staff: boolean, lang: Lang): Promise<void> {
    if (!/^\d+$/.test(telegramId)) return;
    if (staff) await this.syncMenu(Number(telegramId), true, lang);
    try {
      await this.bot.api.sendMessage(telegramId, renderBotText('bot.language.changed', { lang }), { reply_markup: this.keyboard(lang) });
    } catch (e) {
      this.log.warn(`Кнопки ${telegramId} не обновлены: ${(e as Error).message}`);
    }
  }

  /** Две кнопки сотруднику: войти как администратор и как клиент. Закреплённое сообщение всегда под рукой вверху чата. */
  private async replyToStaff(ctx: Context, lang: Lang, pin: boolean): Promise<void> {
    const admin = this.adminUrl;
    const client = this.miniAppUrl;
    const rows: { text: string; web_app: { url: string } }[][] = [];
    if (admin) rows.push([{ text: renderBotText('bot.admin.button', { lang }), web_app: { url: admin } }]);
    if (client) rows.push([{ text: renderBotText('bot.admin.client', { lang }), web_app: { url: client } }]);
    const sent = await ctx.reply(renderBotText('bot.admin.text', { lang }), { reply_markup: { inline_keyboard: rows } });
    if (!pin) return;
    try {
      await ctx.pinChatMessage(sent.message_id, { disable_notification: true });
    } catch (e) {
      this.log.warn(`Сообщение не закреплено: ${(e as Error).message}`);
    }
  }

  private registerHandlers(): void {
    this.bot.command('admin', async (ctx) => {
      const lang = await this.langOf(ctx.from);
      const id = ctx.from?.id;
      if (!id || !this.adminUrl || !(await this.isStaff(String(id)))) {
        await ctx.reply(renderBotText('bot.admin.denied', { lang }));
        return;
      }
      await this.syncMenu(id, true, lang);
      await this.replyToStaff(ctx, lang, true);
    });
    this.bot.callbackQuery(/^(no)?login:(.+)$/, async (ctx) => {
      const lang = await this.langOf(ctx.from);
      const code = ctx.match[2]!;
      let key = 'bot.admin.loginExpired';
      if (ctx.match[1]) {
        this.loginLinks?.deny(code);
        key = 'bot.admin.loginCancelled';
      } else if (await this.isStaff(String(ctx.from.id))) {
        const { id, first_name, last_name, username } = ctx.from;
        const ok = this.loginLinks?.confirm(code, { id: String(id), firstName: first_name, lastName: last_name ?? null, username: username ?? null, photoUrl: null });
        if (ok) key = 'bot.admin.loginDone';
      } else {
        this.loginLinks?.deny(code);
        key = 'bot.admin.denied';
      }
      await ctx.answerCallbackQuery();
      await ctx.editMessageText(renderBotText(key, { lang }));
    });
    this.bot.command('start', async (ctx) => {
      const lang = await this.langOf(ctx.from);
      const payload = typeof ctx.match === 'string' ? ctx.match : '';
      if (payload.startsWith('login_')) {
        await this.promptLogin(ctx, payload.slice('login_'.length), lang);
        return;
      }
      const url = this.miniAppUrl;
      const id = ctx.from?.id;
      const staff = !!id && (await this.isStaff(String(id)));
      if (id) await this.syncMenu(id, staff, lang);
      if (staff && this.adminUrl) {
        await this.replyToStaff(ctx, lang, true);
        await this.showKeyboard(ctx, lang);
        return;
      }
      await ctx.reply(renderBotText('bot.start.text', { lang }), {
        reply_markup: url ? { inline_keyboard: [[{ text: renderBotText('bot.start.button', { lang }), web_app: { url } }]] } : undefined,
      });
      await this.showKeyboard(ctx, lang);
    });
    // Вход подтвердили по ошибке или пришло уведомление о чужом входе: все сессии админки сразу перестают действовать
    this.bot.command('logout', async (ctx) => {
      const lang = await this.langOf(ctx.from);
      if (!ctx.from || !(await this.isStaff(String(ctx.from.id)))) {
        await ctx.reply(renderBotText('bot.admin.denied', { lang }));
        return;
      }
      await this.revokeSessions(String(ctx.from.id));
      await ctx.reply(renderBotText('bot.admin.loggedOut', { lang }));
    });
    this.bot.command('bookings', async (ctx) => this.replyBookings(ctx, 'my', await this.langOf(ctx.from)));
    this.bot.command('ending', async (ctx) => this.replyBookings(ctx, 'ending', await this.langOf(ctx.from)));
    // Владелец или менеджер узнаёт свой ID, чтобы его назначили на точку
    this.bot.command('id', async (ctx) => ctx.reply(renderBotText('bot.bookings.yourId', { lang: await this.langOf(ctx.from), id: ctx.from?.id ?? '' })));
    this.bot.on('message', async (ctx) => {
      const lang = await this.langOf(ctx.from);
      const url = this.miniAppUrl;
      const kind = this.bookingsKind(ctx.message.text);
      if (kind) {
        await this.replyBookings(ctx, kind, lang);
        return;
      }
      if (ctx.from && this.adminUrl && (await this.isStaff(String(ctx.from.id)))) {
        await this.replyToStaff(ctx, lang, false);
        return;
      }
      await ctx.reply(renderBotText('bot.hint.text', { lang }), {
        reply_markup: url ? { inline_keyboard: [[{ text: renderBotText('bot.hint.button', { lang }), web_app: { url } }]] } : undefined,
      });
    });
    this.bot.catch((e) => this.log.error(`update ${e.ctx.update.update_id}: ${e.message}`));
  }

  /** Ссылка на Mini App с параметром запуска: t.me/<bot>?startapp=… (иначе адрес Mini App). */
  private async link(startapp: string): Promise<string | null> {
    if (!this.username) {
      try {
        this.username = (await this.bot.api.getMe()).username;
      } catch {
        // имя бота неизвестно — запасной вариант ниже
      }
    }
    if (this.username) return `https://t.me/${this.username}?startapp=${encodeURIComponent(startapp)}`;
    const url = this.miniAppUrl;
    return url ? `${url}${url.includes('?') ? '&' : '?'}startapp=${encodeURIComponent(startapp)}` : null;
  }

  async send(telegramId: string, key: string, params: NotifierParams, button?: NotifierButton): Promise<void> {
    const link = button ? await this.link(button.startapp) : null;
    const reply_markup = button && link ? { inline_keyboard: [[{ text: renderBotText(button.textKey, params), url: link }]] } : undefined;
    try {
      await (this.bot.api as Api).sendMessage(telegramId, renderBotText(key, params), { reply_markup, link_preview_options: { is_disabled: true } });
    } catch (e) {
      // пользователь заблокировал бота или не начинал диалог — не ошибка системы
      if (e instanceof GrammyError && (e.error_code === 403 || e.error_code === 400)) {
        this.log.warn(`Сообщение ${key} не доставлено (${e.error_code}): ${e.description}`);
        return;
      }
      throw e;
    }
  }

  /** Запуск приёма сообщений: webhook в prod (API_PUBLIC_URL + TELEGRAM_WEBHOOK_SECRET), иначе long polling. */
  async start(): Promise<void> {
    await this.bot.init();
    const { API_PUBLIC_URL, TELEGRAM_WEBHOOK_SECRET, NODE_ENV } = this.env;
    if (NODE_ENV === 'production' && API_PUBLIC_URL && TELEGRAM_WEBHOOK_SECRET) {
      await this.bot.api.setWebhook(`${API_PUBLIC_URL}/api/telegram/webhook`, { secret_token: TELEGRAM_WEBHOOK_SECRET });
      return;
    }
    await this.bot.api.deleteWebhook();
    void this.bot.start({ onStart: () => this.log.log('Бот запущен (long polling)') }).catch((e: Error) => this.log.error(`polling: ${e.message}`));
  }

  async stop(): Promise<void> {
    if (this.bot.isRunning()) await this.bot.stop();
  }
}
