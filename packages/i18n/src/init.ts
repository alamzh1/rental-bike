import i18next, { type i18n } from 'i18next';
import ICU from 'i18next-icu';
import type { Lang } from '@rental/shared';
import { resources } from './resources.generated.js';
import type { ResourceTree } from './keys.js';

/** Переопределения текстов из админки (таблица I18nOverride): lang → «ns.key» → значение. */
export type Overrides = Partial<Record<Lang, Record<string, string>>>;

const LANGS: Lang[] = ['ru', 'en', 'vi'];

function setPath(tree: ResourceTree, key: string, value: string): void {
  const parts = key.split('.');
  let node = tree;
  for (const part of parts.slice(0, -1)) {
    const next = node[part];
    if (typeof next !== 'object') node[part] = {};
    node = node[part] as ResourceTree;
  }
  node[parts[parts.length - 1] as string] = value;
}

/** Словарь языка: все пространства имён из JSON + переопределения. Ключи вида «home.title». */
export function getDictionary(lang: Lang, overrides?: Record<string, string>): ResourceTree {
  const tree = structuredClone(resources[lang] ?? {}) as ResourceTree;
  for (const [key, value] of Object.entries(overrides ?? {})) setPath(tree, key, value);
  return tree;
}

/** Новый экземпляр i18next с ICU (множественное число), фолбэк EN. Инициализация синхронная. */
export function initI18n(lang: Lang, overrides?: Overrides): i18n {
  const instance = i18next.createInstance();
  instance.use(new ICU());
  void instance.init({
    lng: lang,
    fallbackLng: 'en',
    supportedLngs: LANGS,
    resources: Object.fromEntries(LANGS.map((l) => [l, { translation: getDictionary(l, overrides?.[l]) }])),
    initImmediate: false,
    interpolation: { escapeValue: false },
    returnNull: false,
  });
  return instance;
}
