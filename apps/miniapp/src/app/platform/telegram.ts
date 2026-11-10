import {
  backButton,
  hapticFeedback,
  init,
  mainButton,
  miniApp,
  on,
  openLink,
  openTelegramLink,
  postEvent,
  retrieveLaunchParams,
  retrieveRawInitData,
  swipeBehavior,
  themeParams,
  type RGB,
} from '@telegram-apps/sdk-react';
import { versionAtLeast } from './launch';
import type { ColorScheme, Platform } from './types';

// Telegram: SDK, тема по colorScheme (themeParams.isDark), safe area в CSS-переменных --tg-*,
// BackButton, MainButton, haptic. Функции новее Bot API 6.x — с проверкой версии и тихим отказом.

function safe(fn: () => unknown): void {
  try {
    fn();
  } catch {
    // метод не поддерживается этим клиентом Telegram — работаем без него
  }
}

type Insets = { top: number; bottom: number; left: number; right: number };

/** --tg-safe-area-inset-* и --tg-content-safe-area-inset-* из событий Telegram (Bot API 8.0+, в т.ч. полноэкранный режим). */
function bindSafeAreas(version: string | undefined): void {
  const root = document.documentElement.style;
  const write = (prefix: string, i: Insets) => {
    for (const side of ['top', 'bottom', 'left', 'right'] as const) root.setProperty(`--tg-${prefix}-${side}`, `${i[side] ?? 0}px`);
  };
  if (!versionAtLeast(version, '8.0')) return; // старые клиенты: запасной env(safe-area-inset-*) в CSS
  safe(() => on('safe_area_changed', (i) => write('safe-area-inset', i)));
  safe(() => on('content_safe_area_changed', (i) => write('content-safe-area-inset', i)));
  safe(() => postEvent('web_app_request_safe_area'));
  safe(() => postEvent('web_app_request_content_safe_area'));
}

export function createTelegramPlatform(): Platform {
  init();
  const lp = retrieveLaunchParams();
  const version = lp.tgWebAppVersion;
  const initData = retrieveRawInitData();
  const tgUser = lp.tgWebAppData?.user;

  safe(() => themeParams.mountSync());
  safe(() => miniApp.mountSync());
  safe(() => backButton.mount());
  safe(() => mainButton.mount());
  if (versionAtLeast(version, '7.7')) {
    safe(() => swipeBehavior.mount());
    safe(() => swipeBehavior.disableVertical());
  }
  bindSafeAreas(version);
  safe(() => postEvent('web_app_expand'));

  const scheme = (): ColorScheme => (themeParams.isDark() ? 'dark' : 'light');
  const setColor = versionAtLeast(version, '6.1');
  const setBottomBar = versionAtLeast(version, '7.10');

  return {
    kind: 'telegram',
    initData,
    user: tgUser ? { id: tgUser.id, firstName: tgUser.first_name, languageCode: tgUser.language_code } : undefined,
    startParam: lp.tgWebAppStartParam,
    colorScheme: scheme,
    onColorSchemeChange(fn) {
      return themeParams.isDark.sub(() => fn(scheme()));
    },
    setChromeColor(hex) {
      if (!setColor) return;
      const rgb = hex as RGB;
      safe(() => miniApp.setHeaderColor(rgb));
      safe(() => miniApp.setBackgroundColor(rgb));
      if (setBottomBar) safe(() => miniApp.setBottomBarColor(rgb));
    },
    backButton: {
      show: () => safe(() => backButton.show()),
      hide: () => safe(() => backButton.hide()),
      onClick(fn) {
        let off = () => {};
        safe(() => {
          off = backButton.onClick(fn);
        });
        return off;
      },
    },
    mainButton: {
      setParams(p, colors) {
        safe(() =>
          mainButton.setParams({
            text: p.text,
            isVisible: p.visible,
            isEnabled: p.enabled,
            isLoaderVisible: p.loading,
            backgroundColor: colors.bg as RGB,
            textColor: colors.text as RGB,
          }),
        );
      },
      hide: () => safe(() => mainButton.setParams({ isVisible: false })),
      onClick(fn) {
        let off = () => {};
        safe(() => {
          off = mainButton.onClick(fn);
        });
        return off;
      },
    },
    haptic: {
      selection: () => safe(() => hapticFeedback.selectionChanged()),
      impact: (style = 'light') => safe(() => hapticFeedback.impactOccurred(style)),
      notification: (type) => safe(() => hapticFeedback.notificationOccurred(type)),
    },
    openTelegramLink(url) {
      safe(() => openTelegramLink(url));
    },
    openLink(url) {
      safe(() => openLink(url));
    },
    inTelegram: true,
    ready() {
      safe(() => miniApp.ready());
    },
  };
}
