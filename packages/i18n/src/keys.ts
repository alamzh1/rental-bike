import type { Lang } from '@rental/shared';

export type ResourceTree = { [key: string]: string | ResourceTree };
/** lang → namespace (имя файла locales/<lang>/<namespace>.json) → дерево ключей */
export type ResourceMap = Record<Lang, Record<string, ResourceTree>>;
export interface KeyProblem { lang: Lang; key: string; problem: 'missing' | 'empty' }

const LANG_ORDER: Lang[] = ['ru', 'en', 'vi'];

/** Плоский словарь «ns.a.b» → строка. */
export function flattenKeys(tree: ResourceTree, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(tree)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'string') out[key] = v;
    else Object.assign(out, flattenKeys(v, key));
  }
  return out;
}

/** Ключи, которых нет в каком-то языке (относительно объединения всех языков), и пустые строки. */
export function diffLocaleKeys(resources: ResourceMap): KeyProblem[] {
  const flat = Object.fromEntries(
    LANG_ORDER.map((lang) => [lang, flattenKeys(resources[lang] ?? {})]),
  ) as Record<Lang, Record<string, string>>;
  const all = new Set(LANG_ORDER.flatMap((lang) => Object.keys(flat[lang])));
  const problems: KeyProblem[] = [];
  for (const lang of LANG_ORDER) {
    for (const key of [...all].sort()) {
      const value = flat[lang][key];
      if (value === undefined) problems.push({ lang, key, problem: 'missing' });
      else if (value.trim() === '') problems.push({ lang, key, problem: 'empty' });
    }
  }
  return problems;
}
