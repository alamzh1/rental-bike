#!/usr/bin/env node
// Собирает locales/<lang>/<namespace>.json в src/resources.generated.ts (без импорта JSON —
// одинаково работает в Vite, Node и vitest). Ключ файла <namespace>.json становится префиксом «<namespace>.».
// Запуск: node scripts/gen-resources.mjs [--watch]
import { readdirSync, readFileSync, writeFileSync, existsSync, watch } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const localesDir = join(root, 'locales');
const outFile = join(root, 'src', 'resources.generated.ts');
const LANGS = ['ru', 'en', 'vi'];

function generate() {
  const resources = {};
  for (const lang of LANGS) {
    resources[lang] = {};
    const dir = join(localesDir, lang);
    if (!existsSync(dir)) continue;
    for (const file of readdirSync(dir).filter((f) => f.endsWith('.json')).sort()) {
      const ns = file.slice(0, -'.json'.length);
      try {
        resources[lang][ns] = JSON.parse(readFileSync(join(dir, file), 'utf8'));
      } catch (e) {
        throw new Error(`locales/${lang}/${file}: invalid JSON — ${e.message}`);
      }
    }
  }
  const body =
    '// Сгенерировано scripts/gen-resources.mjs из locales/*/*.json — не править руками.\n' +
    "import type { ResourceMap } from './keys.js';\n\n" +
    `export const resources: ResourceMap = ${JSON.stringify(resources, null, 2)};\n`;
  const prev = existsSync(outFile) ? readFileSync(outFile, 'utf8') : '';
  if (prev !== body) writeFileSync(outFile, body);
}

generate();
if (process.argv.includes('--watch')) {
  let timer;
  watch(localesDir, { recursive: true }, () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      try {
        generate();
        console.log('[i18n] resources regenerated');
      } catch (e) {
        console.error(`[i18n] ${e.message}`);
      }
    }, 100);
  });
  console.log('[i18n] watching locales/');
}
