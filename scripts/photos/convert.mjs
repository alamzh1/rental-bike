// Конвертация raw/*.png в WebP и AVIF (400/800/1200 px по ширине) + manifest.json.
// Результат: apps/api/prisma/seed-assets/photos/<slug>/<view>-<size>.{webp,avif}
// Запуск: node scripts/photos/convert.mjs
import { mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = dirname(fileURLToPath(import.meta.url));
const rawDir = join(root, 'raw');
const outRoot = join(root, '../../apps/api/prisma/seed-assets/photos');
const SIZES = [400, 800, 1200];
const VIEWS = ['front34', 'side', 'rear34'];

const manifest = {};
for (const file of readdirSync(rawDir).filter((f) => f.endsWith('.png')).sort()) {
  const m = file.match(/^(.+)-(front34|side|rear34)\.png$/);
  if (!m) continue;
  const [, slug, view] = m;
  mkdirSync(join(outRoot, slug), { recursive: true });
  const sizes = {};
  for (const w of SIZES) {
    const img = () => sharp(join(rawDir, file)).resize({ width: w, withoutEnlargement: false });
    await img().webp({ quality: 80 }).toFile(join(outRoot, slug, `${view}-${w}.webp`));
    await img().avif({ quality: 55, effort: 4 }).toFile(join(outRoot, slug, `${view}-${w}.avif`));
    sizes[w] = { webp: `${slug}/${view}-${w}.webp`, avif: `${slug}/${view}-${w}.avif` };
  }
  (manifest[slug] ??= []).push({ view, sizes });
}
for (const list of Object.values(manifest)) list.sort((a, b) => VIEWS.indexOf(a.view) - VIEWS.indexOf(b.view));
writeFileSync(join(outRoot, 'manifest.json'), JSON.stringify({ demo: true, models: manifest }, null, 2) + '\n');
console.log(Object.entries(manifest).map(([s, l]) => `${s}: ${l.length}`).join('\n'));
