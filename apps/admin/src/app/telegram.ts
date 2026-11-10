// Админка внутри Telegram: при открытии из бота Telegram передаёт подписанные данные входа в адресе страницы.

const KEY = 'admin.tgInitData';

/** Подписанная строка входа из #tgWebAppData=…; null — страница открыта не из Telegram. */
export function initDataFromHash(hash: string): string | null {
  return new URLSearchParams(hash.replace(/^#/, '')).get('tgWebAppData') || null;
}

function capture(): string | null {
  const fromHash = typeof location === 'undefined' ? null : initDataFromHash(location.hash);
  try {
    if (fromHash) {
      sessionStorage.setItem(KEY, fromHash);
      // Подпись не остаётся в адресной строке и в истории
      history.replaceState(null, '', location.pathname + location.search);
      return fromHash;
    }
    return typeof sessionStorage === 'undefined' ? null : sessionStorage.getItem(KEY);
  } catch {
    return fromHash;
  }
}

const initData = capture();

export const telegramInitData = (): string | null => initData;
export const insideTelegram = (): boolean => initData !== null;

type TelegramWindow = Window & { TelegramWebviewProxy?: { postEvent(type: string, data: string): void } };

function postEvent(eventType: string, eventData: Record<string, unknown> = {}): void {
  const w = window as TelegramWindow;
  if (w.TelegramWebviewProxy) w.TelegramWebviewProxy.postEvent(eventType, JSON.stringify(eventData));
  else if (window.parent !== window) window.parent.postMessage(JSON.stringify({ eventType, eventData }), 'https://web.telegram.org');
}

/** На весь экран, и вертикальная прокрутка списков не сворачивает админку. */
export function setupTelegramWindow(): void {
  if (!insideTelegram()) return;
  postEvent('web_app_ready');
  postEvent('web_app_expand');
  postEvent('web_app_setup_swipe_behavior', { allow_vertical_swipe: false });
}
