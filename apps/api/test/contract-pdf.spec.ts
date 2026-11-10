import { describe, expect, it } from 'vitest';
import { findMissingGlyphs, renderContractPdf } from '../src/contracts/contract-pdf';

const VI = 'Hợp đồng thuê xe: Nguyễn Thị Ánh, biển số 59-X1 123.45 — Đà Nẵng, ưu đãi, ở lại, ế, ỳ, ỹ';
const RU = 'Договор аренды байка: Иванов Пётр, депозит 1 000 000 ₫';

describe('PDF договора', () => {
  it('в шрифте есть вьетнамская диакритика и кириллица', () => {
    expect(findMissingGlyphs(VI + RU)).toEqual([]);
  });

  it('проверка не пустая: символ без глифа находится', () => {
    expect(findMissingGlyphs('abc 漢')).toEqual(['漢']);
  });

  it('рендер даёт корректный PDF из двух языковых разделов', async () => {
    const pdf = await renderContractPdf([
      { title: 'Договор аренды', paragraphs: [{ text: RU }, { text: 'Подзаголовок', bold: true }] },
      { title: 'Hợp đồng thuê xe', paragraphs: [{ text: VI }] },
    ]);
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(pdf.subarray(-6).toString()).toContain('%%EOF');
    expect((pdf.toString('latin1').match(/\/Type \/Page\b/g) ?? []).length).toBe(2);
  });
});
