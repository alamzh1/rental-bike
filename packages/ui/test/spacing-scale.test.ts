import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
// @ts-expect-error у пресета нет объявления типов
import preset from '../tailwind-preset.js';

const root = fileURLToPath(new URL('../../..', import.meta.url));
const scale = preset.theme.spacing as Record<string, string>;

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const path = join(dir, e.name);
    if (e.isDirectory()) return sources(path);
    return /\.(tsx?|css)$/.test(e.name) ? [path] : [];
  });
}

// Шкала урезана: класс с theme(spacing.N) вне неё молча не попадает в CSS. Так нижнее меню админки перекрывало контент
describe('theme(spacing.*)', () => {
  it('в коде только значения из шкалы', () => {
    const unknown: string[] = [];
    for (const file of ['apps/miniapp/src', 'apps/admin/src', 'packages/ui/src'].flatMap((d) => sources(join(root, d)))) {
      for (const m of readFileSync(file, 'utf8').matchAll(/theme\(spacing\.([\w.-]+)\)/g)) {
        if (!(m[1]! in scale)) unknown.push(`${file.slice(root.length)}: ${m[1]}`);
      }
    }
    expect(unknown).toEqual([]);
  });
});
