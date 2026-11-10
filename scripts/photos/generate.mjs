// Генерация демо-фото байков через Higgsfield CLI (gpt_image_2_5, ~1.5 кредита за кадр).
// Результат: scripts/photos/raw/<slug>-<view>.png (в .gitignore не нужен — маленькие, но исходники не обязательны).
// Запуск: node scripts/photos/generate.mjs [slug]
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const rawDir = join(root, 'raw');
mkdirSync(rawDir, { recursive: true });

const MODELS = {
  'honda-air-blade-125': 'Honda Air Blade 125 (2023)',
  'honda-vision-110': 'Honda Vision 110 (2023)',
  'honda-vario-160': 'Honda Vario 160 (2024)',
  'yamaha-nvx-155': 'Yamaha NVX 155 (2023)',
  'yamaha-janus-125': 'Yamaha Janus 125 (2023)',
  'vinfast-evo200': 'VinFast Evo200 electric (2024)',
};
const VIEWS = {
  front34: 'Front three-quarter view, the front of the scooter points to the right of the frame, slightly low camera angle.',
  side: 'Near side view with a slight three-quarter turn, the front of the scooter points to the right of the frame, camera at seat height.',
  rear34: 'Rear three-quarter view showing the seat and tail, the front of the scooter still points to the right of the frame.',
};
const style = (m) =>
  `Professional product catalog photo of a real, brand-accurate ${m} scooter, the whole vehicle fully in frame with margin around it, isolated cutout on a seamless flat uniform light warm-grey (#EDEBE8) background, soft contact shadow under the wheels, studio lighting, sharp focus, photorealistic, no text, no people, no logos other than stock manufacturer badges, no license plate.`;

const only = process.argv[2];
for (const [slug, name] of Object.entries(MODELS)) {
  if (only && only !== slug) continue;
  for (const [view, text] of Object.entries(VIEWS)) {
    const out = join(rawDir, `${slug}-${view}.png`);
    if (existsSync(out)) continue;
    const json = execFileSync(
      'higgsfield',
      ['generate', 'create', 'gpt_image_2_5', '--prompt', `${style(name)} ${text}`, '--aspect-ratio', '4:3', '--quality', 'high', '--background', 'opaque', '--wait', '--json'],
      { encoding: 'utf8', maxBuffer: 1 << 26 },
    );
    const url = json.match(/https:[^"\s]+/g)?.find((u) => /\.(png|jpe?g|webp)/i.test(u));
    if (!url) throw new Error(`нет URL результата: ${slug} ${view}\n${json.slice(0, 500)}`);
    writeFileSync(out, Buffer.from(await (await fetch(url)).arrayBuffer()));
    console.log('ok', out);
  }
}
