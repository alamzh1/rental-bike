import { describe, expect, it } from 'vitest';
import { GrammyNotifier } from './grammy-notifier';
import { renderBotText } from './notifier';

const ENV = { MINIAPP_URL: 'https://app.example.com', ADMIN_URL: 'https://admin.example.com' } as NodeJS.ProcessEnv;
type Call = { method: string; payload: Record<string, unknown> };

function bot(staff: string[], env = ENV) {
  const n = new GrammyNotifier('1:test', env);
  n.setStaffCheck(async (id) => staff.includes(id));
  n.bot.botInfo = { id: 1, is_bot: true, first_name: 'b', username: 'b', can_join_groups: false, can_read_all_group_messages: false, supports_inline_queries: false, can_connect_to_business: false, has_main_web_app: false } as never;
  const calls: Call[] = [];
  n.bot.api.config.use(async (_prev, method, payload) => {
    calls.push({ method, payload: payload as Record<string, unknown> });
    return { ok: true, result: method === 'sendMessage' ? { message_id: 42 } : true } as never;
  });
  return { n, calls };
}

const command = (text: string, id = 700) => ({
  update_id: 1,
  message: { message_id: 1, date: 0, text, from: { id, is_bot: false, first_name: 'T', language_code: 'ru' }, chat: { id, type: 'private' as const, first_name: 'T' }, entities: [{ type: 'bot_command' as const, offset: 0, length: text.split(' ')[0]!.length }] },
});
const webApps = (c?: Call) => ((c?.payload.reply_markup as { inline_keyboard?: { web_app: { url: string } }[][] })?.inline_keyboard ?? []).flat().map((b) => b.web_app.url);

describe('бот: админка в Telegram', () => {
  it('сотрудник: кнопка меню ведёт в админку, в закреплённом сообщении — вход администратором и клиентом', async () => {
    const { n, calls } = bot(['700']);
    await n.bot.handleUpdate(command('/start'));
    const menu = calls.find((c) => c.method === 'setChatMenuButton');
    expect(menu?.payload).toMatchObject({ chat_id: 700, menu_button: { type: 'web_app', web_app: { url: ENV.ADMIN_URL } } });
    const message = calls.find((c) => c.method === 'sendMessage');
    expect(webApps(message)).toEqual([ENV.ADMIN_URL, ENV.MINIAPP_URL]);
    expect(JSON.stringify(message?.payload.reply_markup)).toContain('Войти как администратор');
    expect(JSON.stringify(message?.payload.reply_markup)).toContain('Войти как клиент');
    expect(calls.find((c) => c.method === 'pinChatMessage')?.payload).toMatchObject({ chat_id: 700, message_id: 42, disable_notification: true });
  });

  it('любое сообщение сотрудника: те же две кнопки без нового закрепления', async () => {
    const { n, calls } = bot(['700']);
    await n.bot.handleUpdate({ update_id: 2, message: { message_id: 2, date: 0, text: 'привет', from: { id: 700, is_bot: false, first_name: 'T', language_code: 'ru' }, chat: { id: 700, type: 'private', first_name: 'T' } } });
    expect(webApps(calls.find((c) => c.method === 'sendMessage'))).toEqual([ENV.ADMIN_URL, ENV.MINIAPP_URL]);
    expect(calls.some((c) => c.method === 'pinChatMessage')).toBe(false);
  });

  it('клиент: обычная кнопка меню, адреса админки нет', async () => {
    const { n, calls } = bot([]);
    await n.bot.handleUpdate(command('/start'));
    expect(calls.find((c) => c.method === 'setChatMenuButton')?.payload).toMatchObject({ chat_id: 700, menu_button: { type: 'default' } });
    expect(webApps(calls.find((c) => c.method === 'sendMessage'))).toEqual([ENV.MINIAPP_URL]);
    expect(JSON.stringify(calls)).not.toContain('admin.example.com');
  });

  it('/admin: сотруднику — админка, клиенту — ничего не выдаёт', async () => {
    const staff = bot(['700']);
    await staff.n.bot.handleUpdate(command('/admin'));
    expect(webApps(staff.calls.find((c) => c.method === 'sendMessage'))).toEqual([ENV.ADMIN_URL, ENV.MINIAPP_URL]);
    const client = bot([]);
    await client.n.bot.handleUpdate(command('/admin'));
    expect(JSON.stringify(client.calls)).not.toContain('admin.example.com');
  });

  it('кнопки броней: /start их показывает, нажатие отвечает списком с кнопкой брони на любом языке', async () => {
    const { n, calls } = bot([]);
    n.setBookingsReply(async (id, kind) => ({ text: `${kind} ${id}`, open: [{ code: 'BK-1', startapp: 'booking_1' }] }));
    await n.bot.handleUpdate(command('/start'));
    const keyboard = calls.map((c) => c.payload.reply_markup as { keyboard?: { text: string }[][] }).find((m) => m?.keyboard)?.keyboard;
    expect(keyboard?.flat().map((b) => b.text)).toEqual(['📋 Мои брони', '⏰ Когда заканчиваются']);
    calls.length = 0;
    const press = (text: string) => ({ update_id: 2, message: { message_id: 2, date: 0, text, from: { id: 700, is_bot: false, first_name: 'T', language_code: 'ru' }, chat: { id: 700, type: 'private' as const, first_name: 'T' } } });
    await n.bot.handleUpdate(press('⏰ When they end'));
    const sent = calls.find((c) => c.method === 'sendMessage');
    expect(sent?.payload.text).toBe('ending 700');
    expect(JSON.stringify(sent?.payload.reply_markup)).toContain('startapp=booking_1');
  });

  it('/id называет Telegram ID, чтобы человека можно было назначить на точку', async () => {
    const { n, calls } = bot([]);
    await n.bot.handleUpdate(command('/id', 701));
    expect(calls.find((c) => c.method === 'sendMessage')?.payload.text).toContain('701');
  });

  it('без HTTPS-адреса админки кнопка не выдаётся', async () => {
    const { n, calls } = bot(['700'], { MINIAPP_URL: ENV.MINIAPP_URL, ADMIN_URL: 'http://localhost:5174' } as NodeJS.ProcessEnv);
    await n.bot.handleUpdate(command('/start'));
    expect(webApps(calls.find((c) => c.method === 'sendMessage'))).toEqual([ENV.MINIAPP_URL]);
  });

  it('сбой кнопки меню и закрепления не мешает ответить на /start', async () => {
    const n = new GrammyNotifier('1:test', ENV);
    n.setStaffCheck(async () => true);
    n.bot.botInfo = bot([]).n.bot.botInfo;
    const calls: string[] = [];
    n.bot.api.config.use(async (_prev, method) => {
      calls.push(method);
      if (method === 'setChatMenuButton' || method === 'pinChatMessage') throw new Error('network');
      return { ok: true, result: method === 'sendMessage' ? { message_id: 42 } : true } as never;
    });
    await n.bot.handleUpdate(command('/start'));
    expect(calls).toContain('sendMessage');
  });
});

describe('бот: вход в админку без номера телефона', () => {
  const links = (live = true) => {
    const state = { confirmed: null as unknown, denied: false };
    return { state, api: { isLive: () => live, origin: () => ({ ip: '203.0.113.7', country: 'VN', device: 'Chrome, Mac' }), confirm: (_c: string, u: unknown) => ((state.confirmed = u), live), deny: () => void (state.denied = true) } };
  };
  const press = (data: string, id = 700) => ({
    update_id: 3,
    callback_query: { id: 'q', from: { id, is_bot: false, first_name: 'T', language_code: 'ru' }, chat_instance: 'c', data, message: { message_id: 5, date: 0, chat: { id, type: 'private' as const, first_name: 'T' }, text: 'x' } },
  });

  it('сотрудник получает кнопку подтверждения и вход проходит только после нажатия', async () => {
    const { n, calls } = bot(['700']);
    const l = links();
    n.setLoginLinks(l.api);
    await n.bot.handleUpdate(command('/start login_abc'));
    const prompt = calls.find((c) => c.method === 'sendMessage');
    expect(JSON.stringify(prompt?.payload.reply_markup)).toContain('login:abc');
    expect(prompt?.payload.text).toContain('203.0.113.7');
    expect(prompt?.payload.text).toContain('Chrome, Mac');
    expect(l.state.confirmed).toBeNull();
    await n.bot.handleUpdate(press('login:abc'));
    expect(l.state.confirmed).toMatchObject({ id: '700', firstName: 'T' });
  });

  it('чужой человек по этой ссылке не подтвердит вход, браузер получит отказ', async () => {
    const { n } = bot([]);
    const l = links();
    n.setLoginLinks(l.api);
    await n.bot.handleUpdate(command('/start login_abc', 701));
    expect(l.state.denied).toBe(true);
    await n.bot.handleUpdate(press('login:abc', 701));
    expect(l.state.confirmed).toBeNull();
  });

  it('/logout закрывает сессии сотрудника и не работает для остальных', async () => {
    const closed: string[] = [];
    const { n } = bot(['700']);
    n.setSessionRevoker(async (id) => void closed.push(id));
    await n.bot.handleUpdate(command('/logout', 700));
    await n.bot.handleUpdate(command('/logout', 701));
    expect(closed).toEqual(['700']);
  });

  it('«Отмена» и устаревшая ссылка не дают войти', async () => {
    const { n, calls } = bot(['700']);
    const l = links();
    n.setLoginLinks(l.api);
    await n.bot.handleUpdate(press('nologin:abc'));
    expect(l.state.denied).toBe(true);
    expect(l.state.confirmed).toBeNull();
    const old = links(false);
    n.setLoginLinks(old.api);
    calls.length = 0;
    await n.bot.handleUpdate(command('/start login_abc'));
    expect(JSON.stringify(calls.find((c) => c.method === 'sendMessage')?.payload.reply_markup ?? '')).not.toContain('login:');
  });
});

describe('бот: язык из приложения', () => {
  const texts = (calls: Call[]) => calls.filter((c) => c.method === 'sendMessage').map((c) => c.payload.text as string);

  it('выбранный язык важнее языка Telegram: и текст, и кнопки', async () => {
    const { n, calls } = bot([]);
    n.setLangSource(async () => 'vi');
    await n.bot.handleUpdate(command('/start'));
    expect(texts(calls)[0]).toBe(renderBotText('bot.start.text', { lang: 'vi' }));
    expect(JSON.stringify(calls.at(-1)?.payload.reply_markup)).toContain(renderBotText('bot.bookings.my', { lang: 'vi' }));
  });

  it('язык не выбран: остаётся язык Telegram', async () => {
    const { n, calls } = bot([]);
    await n.bot.handleUpdate(command('/start'));
    expect(texts(calls)[0]).toBe(renderBotText('bot.start.text', { lang: 'ru' }));
  });

  it('смена языка обновляет кнопки в чате; сотруднику и кнопку меню', async () => {
    const { n, calls } = bot(['700']);
    await n.languageChanged('700', true, 'en');
    expect(calls.find((c) => c.method === 'setChatMenuButton')?.payload).toMatchObject({ chat_id: 700, menu_button: { text: renderBotText('bot.admin.menu', { lang: 'en' }) } });
    const message = calls.find((c) => c.method === 'sendMessage');
    expect(message?.payload.text).toBe(renderBotText('bot.language.changed', { lang: 'en' }));
    expect(JSON.stringify(message?.payload.reply_markup)).toContain(renderBotText('bot.bookings.my', { lang: 'en' }));
  });

  it('клиент «с улицы» без настоящего Telegram ID сообщений не получает', async () => {
    const { n, calls } = bot([]);
    await n.languageChanged('walkin:1', false, 'en');
    expect(calls).toEqual([]);
  });
});
