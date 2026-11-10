import { describe, expect, it } from 'vitest';
import {
  detectLang,
  diffLocaleKeys,
  formatDate,
  formatPrice,
  formatTime,
  initI18n,
  pickText,
  resources,
  type ResourceMap,
} from '../src/index.js';

const NB = ' '; // неразрывный пробел: сумма и валюта не разрываются переносом
const TZ = 'Asia/Ho_Chi_Minh';

describe('detectLang (ТЗ §7)', () => {
  it.each([
    ['ru', 'ru'],
    ['uk', 'ru'],
    ['be', 'ru'],
    ['kk', 'ru'],
    ['ru-RU', 'ru'],
    ['vi', 'vi'],
    ['vi-VN', 'vi'],
    ['en', 'en'],
    ['de', 'en'],
    ['zh-hans', 'en'],
    ['', 'en'],
    [undefined, 'en'],
  ] as const)('%s → %s', (code, lang) => expect(detectLang(code)).toBe(lang));
});

describe('formatPrice — таблица §7', () => {
  it('RU с пересчётом в рубли: «150 000 ₫ (≈ 530 ₽)»', () => {
    expect(formatPrice(150_000, 'ru', { currency: 'RUB', rate: 0.003533 })).toBe(`150${NB}000${NB}₫ (≈${NB}530${NB}₽)`);
  });
  it('EN с пересчётом в доллары: «150,000 ₫ (≈ $5.70)»', () => {
    expect(formatPrice(150_000, 'en', { currency: 'USD', rate: 0.000038 })).toBe(`150,000${NB}₫ (≈${NB}$5.70)`);
  });
  it('VI только в донгах: «150.000 ₫»', () => {
    expect(formatPrice(150_000, 'vi')).toBe(`150.000${NB}₫`);
  });
  it('валюта отображения VND — без пересчёта', () => {
    expect(formatPrice(150_000, 'ru', { currency: 'VND', rate: 1 })).toBe(`150${NB}000${NB}₫`);
  });
  it('доллары в RU — запятая и знак после суммы', () => {
    expect(formatPrice(1_500_000, 'ru', { currency: 'USD', rate: 0.000038 })).toBe(`1${NB}500${NB}000${NB}₫ (≈${NB}57,00${NB}$)`);
  });
  it('маленькие суммы и ноль', () => {
    expect(formatPrice(0, 'en')).toBe(`0${NB}₫`);
    expect(formatPrice(999, 'vi')).toBe(`999${NB}₫`);
  });
});

describe('formatDate / formatTime — в часовом поясе точки', () => {
  // 12.11.2026 14:30 по Вьетнаму = 07:30 UTC
  const d = new Date('2026-11-12T07:30:00Z');
  it('дата RU 12.11.2026', () => expect(formatDate(d, 'ru', TZ)).toBe('12.11.2026'));
  it('дата EN 12 Nov 2026', () => expect(formatDate(d, 'en', TZ)).toBe('12 Nov 2026'));
  it('дата VI 12/11/2026', () => expect(formatDate(d, 'vi', TZ)).toBe('12/11/2026'));
  it('время RU 14:30', () => expect(formatTime(d, 'ru', TZ)).toBe('14:30'));
  it('время EN 2:30 PM', () => expect(formatTime(d, 'en', TZ)).toBe('2:30 PM'));
  it('время VI 14:30', () => expect(formatTime(d, 'vi', TZ)).toBe('14:30'));
  it('день считается по точке: 20:00 UTC 12.11 — уже 13.11 во Вьетнаме', () => {
    expect(formatDate(new Date('2026-11-12T20:00:00Z'), 'ru', TZ)).toBe('13.11.2026');
  });
});

describe('pickText — контент из админки, фолбэк EN', () => {
  const t = { ru: 'Байк', en: 'Bike', vi: 'Xe máy' };
  it('язык есть — он', () => expect(pickText(t, 'vi')).toBe('Xe máy'));
  it('перевода нет — EN', () => expect(pickText({ en: 'Bike' }, 'ru')).toBe('Bike'));
  it('пустая строка считается отсутствием перевода', () => expect(pickText({ en: 'Bike', ru: '  ' }, 'ru')).toBe('Bike'));
});

describe('initI18n — i18next + ICU', () => {
  const days = '{count, plural, one {# день} few {# дня} many {# дней} other {# дня}}';
  it('русское множественное число по ICU', () => {
    const i18n = initI18n('ru', { ru: { 'test.days': days } });
    expect(i18n.t('test.days', { count: 1 })).toBe('1 день');
    expect(i18n.t('test.days', { count: 3 })).toBe('3 дня');
    expect(i18n.t('test.days', { count: 5 })).toBe('5 дней');
  });
  it('нет ключа в языке — EN', () => {
    const i18n = initI18n('vi', { en: { 'test.hello': 'Hello' } });
    expect(i18n.t('test.hello')).toBe('Hello');
  });
  it('переопределение из админки накладывается поверх файла', () => {
    const i18n = initI18n('en', { en: { 'test.hello': 'Hi' } });
    expect(i18n.t('test.hello')).toBe('Hi');
    expect(i18n.language).toBe('en');
  });
});

describe('diffLocaleKeys — одинаковые ключи во всех языках', () => {
  it('находит пропущенные, лишние и пустые ключи', () => {
    const res: ResourceMap = {
      ru: { home: { title: 'Главная', cta: { book: 'Забронировать' } } },
      en: { home: { title: 'Home', cta: { book: 'Book' }, extra: 'Extra' } },
      vi: { home: { title: '', cta: {} } },
    };
    expect(diffLocaleKeys(res)).toEqual([
      { lang: 'ru', key: 'home.extra', problem: 'missing' },
      { lang: 'vi', key: 'home.cta.book', problem: 'missing' },
      { lang: 'vi', key: 'home.extra', problem: 'missing' },
      { lang: 'vi', key: 'home.title', problem: 'empty' },
    ]);
  });
  it('пространство имён есть не во всех языках — каждый ключ пропущен', () => {
    const res: ResourceMap = { ru: { bot: { start: 'Старт' } }, en: { bot: { start: 'Start' } }, vi: {} };
    expect(diffLocaleKeys(res)).toEqual([{ lang: 'vi', key: 'bot.start', problem: 'missing' }]);
  });
  it('файлы переводов проекта согласованы', () => {
    expect(diffLocaleKeys(resources)).toEqual([]);
  });
});
