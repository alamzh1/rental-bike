// Чистые правила запуска: где открыто приложение, какая версия Bot API, куда ведёт startapp.

export type LaunchMode = 'telegram' | 'dev' | 'outside';

/** telegram — есть initData; dev — браузер с DEV_AUTH=1; outside — экран «Открой через бота», API не вызывается. */
export function resolveLaunchMode({ initData, devAuth }: { initData: string | undefined; devAuth: boolean }): LaunchMode {
  if (initData && initData.trim() !== '') return 'telegram';
  return devAuth ? 'dev' : 'outside';
}

/** Сравнение версий Bot API «8.0» ≥ «7.10» по числам, не строкам. Неизвестная версия — false. */
export function versionAtLeast(version: string | undefined, min: string): boolean {
  if (!version) return false;
  const a = version.split('.').map(Number);
  const b = min.split('.').map(Number);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    if (Number.isNaN(x)) return false;
    if (x !== y) return x > y;
  }
  return true;
}

const ID = /^[A-Za-z0-9_-]{1,64}$/;

/** startapp из ссылок бота → маршрут: booking_<id>, model_<id>, manager. Остальное игнорируется. */
export function startParamToPath(param: string | null | undefined): string | null {
  if (!param) return null;
  if (param === 'manager') return '/manager';
  if (param === 'documents') return '/profile/documents';
  const match = /^(booking|model)_(.+)$/.exec(param);
  if (!match || !ID.test(match[2] ?? '')) return null;
  return match[1] === 'booking' ? `/bookings/${match[2]}` : `/bikes/${match[2]}`;
}
