import { describe, expect, it } from 'vitest';
import { flattenKeys, resources } from '@rental/i18n';
import { cardTimer } from '../src/features/bookings/status';
import { openEvent } from '../src/app/openEvent';
import { ratingView } from '../src/features/catalog/rating';
import { conditionsView, REQUIRED_DOCUMENTS } from '../src/features/bike/conditions';
import { quickPayEligible } from '../src/features/home/quick';

const NOW = Date.parse('2026-11-12T03:00:00.000Z');
const H = 3_600_000;

// История 39: таймер на карточке — до оплаты, до выдачи или до возврата.
describe('cardTimer — таймер карточки брони', () => {
  it('ожидает оплаты → время удержания', () => {
    const t = cardTimer({ status: 'PENDING_PAYMENT', holdExpiresAt: new Date(NOW + 15 * 60_000).toISOString(), startAt: new Date(NOW + 5 * H).toISOString(), endAt: new Date(NOW + 30 * H).toISOString() }, NOW);
    expect(t).toEqual({ kind: 'payWithin', ms: 15 * 60_000 });
  });
  it('подтверждена → до выдачи (startAt)', () => {
    const t = cardTimer({ status: 'CONFIRMED', holdExpiresAt: null, startAt: new Date(NOW + 5 * H).toISOString(), endAt: new Date(NOW + 30 * H).toISOString() }, NOW);
    expect(t).toEqual({ kind: 'startsIn', ms: 5 * H });
  });
  it('выдана → до возврата (endAt)', () => {
    const t = cardTimer({ status: 'ISSUED', holdExpiresAt: null, startAt: new Date(NOW - H).toISOString(), endAt: new Date(NOW + 30 * H).toISOString() }, NOW);
    expect(t).toEqual({ kind: 'returnIn', ms: 30 * H });
  });
  it('завершённая и отменённая — без таймера', () => {
    for (const status of ['COMPLETED', 'CANCELLED_BY_CLIENT', 'CANCELLED_BY_SYSTEM'])
      expect(cardTimer({ status, holdExpiresAt: null, startAt: new Date(NOW).toISOString(), endAt: new Date(NOW).toISOString() }, NOW)).toBeNull();
  });
});

// История 57: событие открытия с источником deeplink/startapp.
describe('openEvent — событие открытия Mini App', () => {
  it('без startapp источник direct', () => expect(openEvent(undefined)).toEqual({ name: 'open', source: 'direct' }));
  it('рекламная метка сохраняется целиком', () => expect(openEvent('ad_spring')).toEqual({ name: 'open', source: 'startapp:ad_spring' }));
  it('id брони/модели в источник не попадает', () => {
    expect(openEvent('booking_abc123')).toEqual({ name: 'open', source: 'startapp:booking' });
    expect(openEvent('model_xyz')).toEqual({ name: 'open', source: 'startapp:model' });
  });
  it('длинная метка укладывается в лимит API (100 символов)', () => expect(openEvent('x'.repeat(300)).source.length).toBeLessThanOrEqual(100));
});

// Критерий F2: число отзывов не показываем, пока отзывов нет; демо-рейтинг помечен.
describe('ratingView — рейтинг и отзывы', () => {
  it('без рейтинга ничего не показываем', () => expect(ratingView({ rating: null, reviewsCount: 0 })).toEqual({ show: false, showCount: false, demo: false }));
  it('рейтинг без отзывов — только со значком «демо», без числа', () => expect(ratingView({ rating: 4.7, reviewsCount: 0 })).toEqual({ show: true, showCount: false, demo: true }));
  it('есть отзывы — число показываем', () => expect(ratingView({ rating: 4.7, reviewsCount: 3 })).toEqual({ show: true, showCount: true, demo: false }));
});

// История 21: условия — документы и ограничения из настроек, иначе видимая заглушка.
describe('conditionsView — условия карточки модели', () => {
  it('обязательные документы по брифу', () => expect(REQUIRED_DOCUMENTS).toEqual(['passport', 'license', 'idp']));
  it('ограничения заданы → берём текст на языке клиента', () =>
    expect(conditionsView({ ru: 'Не более 200 км в сутки', en: 'Up to 200 km a day' }, 'en')).toEqual({ kind: 'text', text: 'Up to 200 km a day' }));
  it('не заданы или пусты → заглушка', () => {
    expect(conditionsView(null, 'ru')).toEqual({ kind: 'placeholder' });
    expect(conditionsView({ en: '  ' }, 'en')).toEqual({ kind: 'placeholder' });
  });
});

// История 70: повторному клиенту — сразу к оплате после согласия.
describe('quickPayEligible — быстрый путь «Нужен байк сейчас»', () => {
  const ok = { phone: '+84912345678', documentsReady: true, needsLicense: false, delivery: false };
  it('телефон и документы сохранены → быстрый путь', () => expect(quickPayEligible(ok)).toBe(true));
  it('нет телефона', () => expect(quickPayEligible({ ...ok, phone: null })).toBe(false));
  it('телефон не разбирается', () => expect(quickPayEligible({ ...ok, phone: '123' })).toBe(false));
  it('нет документов', () => expect(quickPayEligible({ ...ok, documentsReady: false })).toBe(false));
  it('нужны права, которых нет → полное оформление', () => expect(quickPayEligible({ ...ok, needsLicense: true })).toBe(false));
});

describe('переводы F2', () => {
  it.each([['ru'], ['en'], ['vi']] as const)('%s: новые ключи есть', (lang) => {
    const flat = flattenKeys(resources[lang]);
    for (const k of ['bookings.card.startsIn', 'bike.docs.title', 'bike.docs.passport', 'bike.docs.license', 'bike.docs.idp', 'bike.restrictions.title', 'bike.restrictions.placeholder', 'bike.ratingDemo', 'home.now.listTitle', 'home.now.listText', 'home.now.quick.title', 'home.now.quick.agree', 'home.now.quick.pay', 'home.now.quick.rules'])
      expect(flat[k], k).toBeTruthy();
  });
});
