import { existsSync } from 'node:fs';
import { join } from 'node:path';
import PDFDocument from 'pdfkit';

/** Один языковой раздел договора: заголовок и абзацы (bold — подзаголовок). */
export interface ContractSection {
  title: string;
  paragraphs: { text: string; bold?: boolean }[];
}

// Шрифт Noto Sans (SIL OFL, лицензия рядом): кириллица, латиница и вьетнамская диакритика в одном файле.
// В dist шрифты не копируются сборкой — запасной путь ведёт в исходники.
const FONT_DIRS = [join(__dirname, 'fonts'), join(__dirname, '../../src/contracts/fonts'), join(process.cwd(), 'src/contracts/fonts'), join(process.cwd(), 'apps/api/src/contracts/fonts')];

function fontDir(): string {
  const dir = FONT_DIRS.find((d) => existsSync(join(d, 'NotoSans-Regular.ttf')));
  if (!dir) throw new Error('Contract fonts not found (src/contracts/fonts)');
  return dir;
}

function newDoc(): PDFKit.PDFDocument {
  const dir = fontDir();
  const doc = new PDFDocument({ size: 'A4', margin: 56, info: { Title: 'Rental agreement' } });
  doc.registerFont('Regular', join(dir, 'NotoSans-Regular.ttf'));
  doc.registerFont('Bold', join(dir, 'NotoSans-Bold.ttf'));
  return doc;
}

/** Символы текста, для которых в шрифте нет глифа (в PDF они стали бы «тофу»). Пробельные не считаются. */
export function findMissingGlyphs(text: string): string[] {
  const doc = newDoc();
  try {
    doc.font('Regular');
    const font = (doc as unknown as { _font: { font: { hasGlyphForCodePoint(cp: number): boolean } } })._font.font;
    const missing = new Set<string>();
    for (const ch of text) {
      const cp = ch.codePointAt(0) as number;
      if (/\s/.test(ch) || cp < 32) continue;
      if (!font.hasGlyphForCodePoint(cp)) missing.add(ch);
    }
    return [...missing];
  } finally {
    doc.end();
  }
}

export function renderContractPdf(sections: ContractSection[]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = newDoc();
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    sections.forEach((s, i) => {
      if (i > 0) doc.addPage();
      doc.font('Bold').fontSize(18).text(s.title, { align: 'center' }).moveDown(1);
      for (const p of s.paragraphs) {
        doc.font(p.bold ? 'Bold' : 'Regular').fontSize(p.bold ? 12 : 10.5).text(p.text, { align: 'left' }).moveDown(p.bold ? 0.4 : 0.6);
      }
    });
    doc.end();
  });
}
