import type { ColorScheme, Platform } from './platform';

/** Ставит data-theme на <html> и красит шапку, фон и нижнюю панель Telegram в токен bg. Без перезагрузки. */
export function applyTheme(scheme: ColorScheme, platform: Platform | null): void {
  document.documentElement.dataset.theme = scheme;
  const bg = cssVar('--bg');
  if (!bg) return;
  if (platform) platform.setChromeColor(bg);
  else document.querySelector('meta[name="theme-color"]')?.setAttribute('content', bg);
}

/** Текущее значение токена (после смены темы). */
export function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/** Тема из Telegram (colorScheme) или из системной настройки браузера; следит за сменой. */
export function followTheme(platform: Platform | null): () => void {
  if (platform) {
    applyTheme(platform.colorScheme(), platform);
    return platform.onColorSchemeChange((s) => applyTheme(s, platform));
  }
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  const sync = () => applyTheme(media.matches ? 'dark' : 'light', null);
  sync();
  media.addEventListener('change', sync);
  return () => media.removeEventListener('change', sync);
}
