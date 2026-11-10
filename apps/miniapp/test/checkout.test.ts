import { describe, expect, it } from 'vitest';
import { parsePhone } from '../src/features/checkout/phone';
import { blockedReason, buildBookingRequest } from '../src/features/checkout/request';
import { errorKey, quoteErrorAction } from '../src/features/checkout/errors';

describe('parsePhone — история 26: неверный формат', () => {
  it.each([
    ['+84 912 345 678', '+84912345678'],
    ['+7 (916) 123-45-67', '+79161234567'],
    ['0084912345678', '+84912345678'],
    ['0912345678', '+84912345678'],
  ])('%s → %s', (raw, e164) => expect(parsePhone(raw)).toEqual({ ok: true, e164 }));

  it.each(['', '123', 'abc', '+84 12', '+1234567890123456', '09123'])('«%s» отклоняется', (raw) =>
    expect(parsePhone(raw)).toEqual({ ok: false }),
  );
});

const base = {
  modelId: 'm1',
  range: { from: '2026-11-12T03:00:00.000Z', to: '2026-11-15T03:00:00.000Z' },
  extras: { helmet: 2, bag: 0 },
  method: 'VIETQR' as const,
  phone: '+84912345678',
  agreed: true,
  delivery: false,
  address: '',
};

describe('blockedReason — кнопка оплаты и причина', () => {
  const ready = { ...base, documentsReady: true, licenseOk: true };
  it('без согласия — consent', () => expect(blockedReason({ ...ready, agreed: false })).toBe('consent'));
  it('телефон неверный — phone', () => expect(blockedReason({ ...ready, phone: '12' })).toBe('phone'));
  it('доставка без адреса — address', () => expect(blockedReason({ ...ready, delivery: true, address: '  ' })).toBe('address'));
  it('всё заполнено — null', () => expect(blockedReason(ready)).toBeNull());
  it('согласие важнее телефона', () => expect(blockedReason({ ...ready, agreed: false, phone: '' })).toBe('consent'));
  it('байк не подходит без прав — license', () => expect(blockedReason({ ...ready, licenseOk: false, documentsReady: false })).toBe('license'));
  it('без документов — documents, раньше всего остального', () => expect(blockedReason({ ...ready, documentsReady: false, agreed: false })).toBe('documents'));
});

describe('buildBookingRequest — тело POST /bookings', () => {
  it('самовывоз: нулевые опции отброшены, телефон в E.164', () => {
    expect(buildBookingRequest({ ...base, phone: '0912 345 678' })).toEqual({
      modelId: 'm1',
      startAt: base.range.from,
      endAt: base.range.to,
      extras: [{ id: 'helmet', qty: 2 }],
      paymentMethod: 'VIETQR',
      phone: '+84912345678',
      agreed: true,
      delivery: false,
    });
  });
  it('доставка: адрес и пин уходят в deliveryAddress', () => {
    const r = buildBookingRequest({ ...base, delivery: true, address: ' Hotel Sea, 12 ', pin: { lat: 13.77, lng: 109.22 } }) as {
      delivery: boolean;
      deliveryAddress: string;
    };
    expect(r.delivery).toBe(true);
    expect(r.deliveryAddress).toBe('Hotel Sea, 12 [13.77000, 109.22000]');
  });
});

describe('errorKey — коды API → errors.*', () => {
  it('известный код', () => expect(errorKey('BIKE_TAKEN')).toBe('errors.BIKE_TAKEN'));
  it('код T05', () => expect(errorKey('HOLD_EXPIRED')).toBe('errors.HOLD_EXPIRED'));
  it('неизвестный → UNKNOWN', () => expect(errorKey('WAT')).toBe('errors.UNKNOWN'));
});

// История 36 / R28: минимум срока и времени до выдачи — повтор не поможет, нужно выбрать другие даты.
describe('quoteErrorAction — что предложить, если POST /quotes вернул ошибку', () => {
  it.each([['MIN_RENT_DAYS'], ['LEAD_TIME']])('%s → выбор дат', (code) => expect(quoteErrorAction(code)).toBe('dates'));
  it.each([['NETWORK'], ['UNKNOWN'], ['PAYMENT_PROVIDER_ERROR'], ['NOT_FOUND']])('%s → «Повторить»', (code) => expect(quoteErrorAction(code)).toBe('retry'));
});
