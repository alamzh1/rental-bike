import { detectLang, initI18n } from '@rental/i18n';
import type { Lang } from '@rental/shared';
import type { i18n } from 'i18next';

const KEY = 'admin.lang';
const UNSYNCED_KEY = 'admin.lang.unsynced';
let instance: i18n | null = null;

function storedLang(): Lang | null {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'ru' || v === 'en' || v === 'vi' ? v : null;
  } catch {
    return null;
  }
}

/** Язык админки: выбранный в меню, иначе язык браузера (ru/uk/be/kk → ru, vi → vi, иначе en). */
export function initialLang(): Lang {
  return storedLang() ?? detectLang(typeof navigator === 'undefined' ? undefined : navigator.language);
}

export function getI18n(): i18n {
  if (!instance) {
    instance = initI18n(initialLang());
    document.documentElement.lang = instance.language;
    instance.on('languageChanged', (l) => {
      document.documentElement.lang = l;
    });
  }
  return instance;
}

/** Язык, который сотрудник выбрал сам; язык браузера не считается: он не должен менять язык сообщений бота. */
export const chosenLang = storedLang;

/** Выбранный язык, о котором API ещё не знает. Бот пишет на нём, а на странице входа сессии пока нет. */
export function langToSync(): Lang | null {
  try {
    return localStorage.getItem(UNSYNCED_KEY) ? storedLang() : null;
  } catch {
    return null;
  }
}

export function markLangSynced(): void {
  try {
    localStorage.removeItem(UNSYNCED_KEY);
  } catch {
    // приватный режим — язык отправится ещё раз
  }
}

export function setLang(lang: Lang): void {
  try {
    localStorage.setItem(KEY, lang);
    localStorage.setItem(UNSYNCED_KEY, '1');
  } catch {
    // приватный режим — язык просто не запомнится
  }
  void getI18n().changeLanguage(lang);
}
