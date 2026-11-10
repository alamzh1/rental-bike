const MAX_SOURCE = 100;
/** startapp-параметры с id внутри: в источник идёт только вид ссылки, чтобы воронка не рассыпалась на тысячи значений. */
const ID_PREFIXES = ['booking_', 'model_'];

/** Событие открытия Mini App (история 57): источник — метка startapp (deeplink, реклама) или `direct`. */
export function openEvent(startParam: string | undefined): { name: 'open'; source: string } {
  const raw = startParam?.trim();
  if (!raw) return { name: 'open', source: 'direct' };
  const idPrefix = ID_PREFIXES.find((p) => raw.startsWith(p));
  const label = idPrefix ? idPrefix.slice(0, -1) : raw;
  return { name: 'open', source: `startapp:${label}`.slice(0, MAX_SOURCE) };
}
