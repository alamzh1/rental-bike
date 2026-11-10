// Платформа, на которой запущен Mini App. Две реализации: Telegram (SDK) и браузер (dev, DEV_AUTH=1).
// Экраны работают только через этот интерфейс и не импортируют SDK напрямую.

export type ColorScheme = 'light' | 'dark';

export interface PlatformUser {
  id: number;
  firstName?: string;
  languageCode?: string;
}

export interface MainButtonParams {
  text: string;
  visible: boolean;
  enabled: boolean;
  loading: boolean;
}

export interface Platform {
  kind: 'telegram' | 'browser';
  /** Сырой initData для POST /auth/telegram; undefined — вне Telegram. */
  initData: string | undefined;
  user: PlatformUser | undefined;
  startParam: string | undefined;
  colorScheme(): ColorScheme;
  /** Подписка на смену темы Telegram (themeChanged) или системной темы в браузере. */
  onColorSchemeChange(fn: (scheme: ColorScheme) => void): () => void;
  /** Шапка, фон и нижняя панель Telegram — в цвет токена bg. */
  setChromeColor(hex: string): void;
  /** Системная «Назад»; null — браузер, экран рисует свою кнопку. */
  backButton: { show(): void; hide(): void; onClick(fn: () => void): () => void } | null;
  /** Telegram MainButton (accent / on-accent); null — браузер, рисуется своя кнопка. */
  mainButton: {
    setParams(p: MainButtonParams, colors: { bg: string; text: string }): void;
    hide(): void;
    onClick(fn: () => void): () => void;
  } | null;
  haptic: {
    selection(): void;
    impact(style?: 'light' | 'medium' | 'heavy'): void;
    notification(type: 'success' | 'error' | 'warning'): void;
  };
  openTelegramLink(url: string): void;
  /** Обычная ссылка: внутри Telegram открывается системным браузером, там же скачиваются файлы. */
  openLink(url: string): void;
  /** Запущено внутри Telegram: скачивание blob в его окне не работает. */
  inTelegram: boolean;
  /** Сообщить Telegram, что интерфейс готов (убирает заставку). */
  ready(): void;
}
