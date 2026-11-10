import { describe, expect, it } from 'vitest';
import jsQR from 'jsqr';
import QRCode from 'qrcode';
import { encodeQr, rsDivisor, rsRemainder } from '../src/features/payment/qr';

const bits = (m: boolean[][]) => m.map((r) => r.map((c) => (c ? 1 : 0)));

describe('encodeQr', () => {
  it('короткая строка → версия 1 (21×21)', () => expect(encodeQr('BK-24117')).toHaveLength(21));
  it('длинная строка растёт: 100 байт → версия 6 (41×41)', () => expect(encodeQr('x'.repeat(100))).toHaveLength(41));
  it('три искателя в углах: 7×7 рамка с центром', () => {
    const m = bits(encodeQr('BK-24117'));
    const n = m.length;
    for (const [x0, y0] of [[0, 0], [n - 7, 0], [0, n - 7]] as const) {
      expect(m[y0]![x0]).toBe(1);
      expect(m[y0 + 1]![x0 + 1]).toBe(0);
      expect(m[y0 + 3]![x0 + 3]).toBe(1);
      expect(m[y0 + 6]![x0 + 6]).toBe(1);
    }
  });
  it('полосы синхронизации чередуются', () => {
    const m = bits(encodeQr('BK-24117'));
    for (let i = 8; i < 13; i++) expect(m[6]![i]).toBe(i % 2 === 0 ? 1 : 0);
  });
  it('информация о формате: BCH-код корректен (остаток от деления на 0x537 = 0)', () => {
    const m = bits(encodeQr('BK-24117'));
    // первая копия, биты 14..0 читаются как в ISO 18004: слева (8,0..5),(8,7),(8,8),(7,8),(5..0,8)
    const pos: Array<[number, number]> = [[0, 8], [1, 8], [2, 8], [3, 8], [4, 8], [5, 8], [7, 8], [8, 8], [8, 7], [8, 5], [8, 4], [8, 3], [8, 2], [8, 1], [8, 0]];
    let v = 0;
    for (const [x, y] of pos) v = (v << 1) | m[y]![x]!;
    v ^= 0x5412;
    let rem = v;
    for (let i = 14; i >= 10; i--) if ((rem >>> i) & 1) rem ^= 0x537 << (i - 10);
    expect(rem).toBe(0);
    expect(v >>> 13).toBe(0); // уровень M
  });
  it('слишком длинный текст — ошибка', () => expect(() => encodeQr('x'.repeat(2000))).toThrow());
});

describe('Рид-Соломон (данные из учебного примера «HELLO WORLD», 1-M)', () => {
  it('генератор степени 7', () => expect(rsDivisor(7)).toEqual([127, 122, 154, 164, 11, 68, 117]));
  it('10 байт коррекции', () => {
    const data = [32, 91, 11, 120, 209, 114, 220, 77, 67, 64, 236, 17, 236, 17, 236, 17];
    expect(rsRemainder(data, rsDivisor(10))).toEqual([196, 35, 39, 119, 235, 215, 231, 226, 93, 23]);
  });
});

// Эталон: настоящая строка VietQR (EMVCo, NAPAS 970422, ~200 байт → версия ≥ 8) кодируется так же, как библиотекой
// qrcode (та же версия и маска, байтовый режим, уровень M), и читается декодером jsQR обратно в исходную строку.
// Счёт и сумма — тестовые, не реквизиты владельца.
const tlv = (id: string, value: string) => `${id}${String(value.length).padStart(2, '0')}${value}`;
function crc16(text: string): string {
  let crc = 0xffff;
  for (const ch of Buffer.from(text, 'utf8')) {
    crc ^= ch << 8;
    for (let i = 0; i < 8; i++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}
function vietQr(): string {
  const merchant = tlv('00', 'A000000727') + tlv('01', tlv('00', '970422') + tlv('01', 'VQRQ0000TEST0000')) + tlv('02', 'QRIBFTTA');
  const purpose = tlv('08', 'BK24117 THANH TOAN DAT XE');
  const body = tlv('00', '01') + tlv('01', '12') + tlv('38', merchant) + tlv('53', '704') + tlv('54', '1180000') + tlv('58', 'VN')
    + tlv('59', 'RENTAL TEST MERCHANT') + tlv('60', 'QUY NHON') + tlv('62', purpose + tlv('05', 'PAYOS-TEST-0001'));
  const head = `${body}6304`;
  return head + crc16(head);
}

/** Маска из информации о формате (первая копия) — чтобы сравнить с эталоном при той же маске. */
function maskOf(m: number[][]): number {
  const pos: Array<[number, number]> = [[0, 8], [1, 8], [2, 8], [3, 8], [4, 8], [5, 8], [7, 8], [8, 8], [8, 7], [8, 5], [8, 4], [8, 3], [8, 2], [8, 1], [8, 0]];
  let v = 0;
  for (const [x, y] of pos) v = (v << 1) | m[y]![x]!;
  return ((v ^ 0x5412) >>> 10) & 7;
}

function render(m: number[][], scale = 4, quiet = 4): { data: Uint8ClampedArray; size: number } {
  const size = (m.length + quiet * 2) * scale;
  const data = new Uint8ClampedArray(size * size * 4).fill(255);
  for (let y = 0; y < m.length; y++)
    for (let x = 0; x < m.length; x++)
      if (m[y]![x])
        for (let dy = 0; dy < scale; dy++)
          for (let dx = 0; dx < scale; dx++) {
            const i = (((y + quiet) * scale + dy) * size + (x + quiet) * scale + dx) * 4;
            data[i] = data[i + 1] = data[i + 2] = 0;
          }
  return { data, size };
}

describe('encodeQr — эталон для строки VietQR', () => {
  const text = vietQr();
  const m = bits(encodeQr(text));
  const version = (m.length - 17) / 4;

  it('строка как у VietQR: ~200 байт, версия ≥ 8', () => {
    expect(text.startsWith('000201010212')).toBe(true);
    expect(Buffer.byteLength(text)).toBeGreaterThanOrEqual(180);
    expect(Buffer.byteLength(text)).toBeLessThanOrEqual(213);
    expect(version).toBeGreaterThanOrEqual(8);
  });

  it('матрица совпадает с библиотекой qrcode (та же версия, маска, байтовый режим, уровень M)', () => {
    const ref = QRCode.create([{ data: Buffer.from(text, 'utf8'), mode: 'byte' }], { errorCorrectionLevel: 'M', version, maskPattern: maskOf(m) as QRCode.QRCodeMaskPattern });
    expect(ref.modules.size).toBe(m.length);
    const expected = Array.from({ length: ref.modules.size }, (_, y) => Array.from({ length: ref.modules.size }, (_, x) => (ref.modules.get(y, x) ? 1 : 0)));
    const diff = expected.flatMap((row, y) => row.flatMap((v, x) => (v !== m[y]![x] ? [`${x},${y}`] : [])));
    expect(diff).toEqual([]);
  });

  it('jsQR читает исходную строку', () => {
    const { data, size } = render(m);
    const decoded = jsQR(data, size, size);
    expect(decoded?.data).toBe(text);
  });
});
