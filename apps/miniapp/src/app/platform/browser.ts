import type { Role } from '@rental/shared';
import type { ColorScheme, Platform } from './types';

// Браузерный режим для разработки (DEV_AUTH=1): тестовые пользователи, тема по системной настройке,
// своя кнопка «Назад» и своя главная кнопка. Пользователь выбирается параметром ?dev_user=client|manager|admin.

const DEV_USERS: Record<'client' | 'manager' | 'admin', { id: number; first_name: string; role: Role }> = {
  client: { id: 900001, first_name: 'Test', role: 'CLIENT' },
  manager: { id: 900002, first_name: 'Manager', role: 'MANAGER' },
  admin: { id: 900003, first_name: 'Admin', role: 'ADMIN' },
};

function pickDevUser(): keyof typeof DEV_USERS {
  const url = new URL(window.location.href);
  const fromUrl = url.searchParams.get('dev_user');
  let stored: string | null = null;
  try {
    if (fromUrl) sessionStorage.setItem('rental.dev-user', fromUrl);
    stored = sessionStorage.getItem('rental.dev-user');
  } catch {
    stored = fromUrl;
  }
  return stored && stored in DEV_USERS ? (stored as keyof typeof DEV_USERS) : 'client';
}

export function createBrowserPlatform(): Platform & { devRole: Role } {
  const devKey = pickDevUser();
  const dev = DEV_USERS[devKey];
  const url = new URL(window.location.href);
  const languageCode = url.searchParams.get('lang') ?? navigator.language;
  const user = { id: dev.id, first_name: dev.first_name, language_code: languageCode };
  const initData = new URLSearchParams({
    user: JSON.stringify(user),
    auth_date: String(Math.floor(Date.now() / 1000)),
    hash: 'dev',
  }).toString();
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  const scheme = (): ColorScheme => (media.matches ? 'dark' : 'light');

  return {
    kind: 'browser',
    devRole: dev.role,
    initData,
    user: { id: dev.id, firstName: dev.first_name, languageCode },
    startParam: url.searchParams.get('startapp') ?? undefined,
    colorScheme: scheme,
    onColorSchemeChange(fn) {
      const listener = () => fn(scheme());
      media.addEventListener('change', listener);
      return () => media.removeEventListener('change', listener);
    },
    setChromeColor(hex) {
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', hex);
    },
    backButton: null,
    mainButton: null,
    haptic: { selection() {}, impact() {}, notification() {} },
    openTelegramLink(link) {
      window.open(link, '_blank', 'noopener');
    },
    openLink(link) {
      window.open(link, '_blank', 'noopener');
    },
    inTelegram: false,
    ready() {},
  };
}
