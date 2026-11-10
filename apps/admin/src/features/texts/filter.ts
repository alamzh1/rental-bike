import type { AdminTextRow } from '@rental/shared';

// Поиск по строкам интерфейса: ключ, текст на любом языке (и в JSON, и в правке), раздел (первая часть ключа).

export function namespaces(rows: AdminTextRow[]): string[] {
  return [...new Set(rows.map((r) => r.key.split('.')[0]!))].sort();
}

export function filterTexts(rows: AdminTextRow[], f: { q?: string; ns?: string; onlyEdited?: boolean }): AdminTextRow[] {
  const q = (f.q ?? '').trim().toLocaleLowerCase();
  return rows.filter((r) => {
    if (f.ns && !r.key.startsWith(`${f.ns}.`)) return false;
    if (f.onlyEdited && Object.keys(r.override).length === 0) return false;
    if (!q) return true;
    const hay = [r.key, ...Object.values(r.base), ...Object.values(r.override)].join('\n').toLocaleLowerCase();
    return hay.includes(q);
  });
}
