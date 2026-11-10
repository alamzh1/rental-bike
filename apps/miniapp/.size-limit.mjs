// Бюджет первого экрана (история 4): JS, который грузится до показа главной, ≤ 250 КБ gzip.
// Состав берётся из манифеста Vite: точка входа + её статические импорты. Ленивые чанки фич — вне бюджета,
// но каждая фича обязана быть отдельным чанком: иначе проверка падает.
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const dist = join(here, 'dist');
const manifest = JSON.parse(readFileSync(join(dist, '.vite', 'manifest.json'), 'utf8'));
const entryKey = Object.keys(manifest).find((k) => manifest[k].isEntry);
if (!entryKey) throw new Error('size-limit: в манифесте нет точки входа — сначала vite build');

const initial = new Set();
(function walk(key) {
  const chunk = manifest[key];
  if (!chunk || initial.has(chunk.file)) return;
  initial.add(chunk.file);
  for (const dep of chunk.imports ?? []) walk(dep);
})(entryKey);

const features = readdirSync(join(here, 'src', 'features')).filter((f) => f !== 'home');
const missing = features.filter((f) => {
  const chunk = manifest[`src/features/${f}/index.tsx`];
  return !chunk || !chunk.isDynamicEntry || initial.has(chunk.file);
});
if (missing.length) throw new Error(`size-limit: фичи не вынесены в отдельные чанки: ${missing.join(', ')}`);

export default [
  {
    name: 'Первый экран (JS, gzip)',
    path: [...initial].map((f) => `dist/${f}`),
    limit: '250 kB',
    gzip: true,
    running: false,
  },
];
