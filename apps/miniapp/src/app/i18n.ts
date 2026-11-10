import { initI18n, type ResourceTree } from '@rental/i18n';
import type { Lang } from '@rental/shared';
import type { i18n } from 'i18next';

let instance: i18n | null = null;

/** Единственный экземпляр i18next приложения; повторный вызов переключает язык мгновенно. */
export function getI18n(lang: Lang): i18n {
  if (!instance) {
    instance = initI18n(lang);
    document.documentElement.lang = lang;
    instance.on('languageChanged', (l) => {
      document.documentElement.lang = l;
    });
  } else if (instance.language !== lang) {
    void instance.changeLanguage(lang);
  }
  return instance;
}

/** Правки текстов из админки (GET /i18n/{lang}) поверх JSON: дерево или плоские ключи «ns.key». */
export function applyOverrides(lang: Lang, dictionary: unknown): void {
  if (!instance || !dictionary || typeof dictionary !== 'object') return;
  const tree: ResourceTree = {};
  for (const [key, value] of Object.entries(dictionary as Record<string, unknown>)) {
    if (typeof value === 'object' && value !== null) tree[key] = value as ResourceTree;
    else if (typeof value === 'string') setPath(tree, key.split('.'), value);
  }
  instance.addResourceBundle(lang, 'translation', tree, true, true);
}

function setPath(tree: ResourceTree, parts: string[], value: string): void {
  let node = tree;
  for (const part of parts.slice(0, -1)) {
    if (typeof node[part] !== 'object') node[part] = {};
    node = node[part] as ResourceTree;
  }
  node[parts[parts.length - 1] as string] = value;
}
