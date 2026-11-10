#!/usr/bin/env node
// Пересобирает docs/i18n-vi-review.md — список VI-ключей на вычитку носителем (история 80).
// Отметку «вычитано» ставит человек в колонке «Проверено»: при пересборке отметки сохраняются по ключу.
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';

const root = new URL('../../', import.meta.url).pathname;
const dir = `${root}packages/i18n/locales`;
const out = `${root}docs/i18n-vi-review.md`;

// Сначала то, что видит клиент; админка — в конце.
const ORDER = ['common', 'onboarding', 'home', 'dates', 'catalog', 'bike', 'favorites', 'checkout', 'payment', 'bookings', 'profile', 'errors', 'bot', 'contract', 'manager', 'admin', 'admin-fleet'];

const flat = (obj, prefix = '') =>
  Object.entries(obj).flatMap(([k, v]) => (typeof v === 'string' ? [[`${prefix}${k}`, v]] : flat(v, `${prefix}${k}.`)));
const cell = (s) => s.replace(/\|/g, '\\|').replace(/\n/g, '<br>');

const reviewed = new Map();
if (existsSync(out)) {
  for (const line of readFileSync(out, 'utf8').split('\n')) {
    const m = /^\| `([^`]+)` \|.*\| (.*?) \|$/.exec(line);
    if (m && m[2].trim()) reviewed.set(m[1], m[2].trim());
  }
}

const namespaces = readdirSync(`${dir}/vi`).map((f) => f.replace(/\.json$/, ''));
namespaces.sort((a, b) => (ORDER.indexOf(a) + 1 || 99) - (ORDER.indexOf(b) + 1 || 99) || a.localeCompare(b));

let total = 0;
let done = 0;
const sections = namespaces.map((ns) => {
  const vi = flat(JSON.parse(readFileSync(`${dir}/vi/${ns}.json`, 'utf8')));
  const en = new Map(flat(JSON.parse(readFileSync(`${dir}/en/${ns}.json`, 'utf8'))));
  const rows = vi.map(([key, value]) => {
    const full = `${ns}.${key}`;
    total++;
    const mark = reviewed.get(full) ?? '';
    if (mark) done++;
    return `| \`${full}\` | ${cell(en.get(key) ?? '')} | ${cell(value)} | ${mark} |`;
  });
  return `## ${ns} (${vi.length})\n\n| Ключ | EN (оригинал смысла) | VI сейчас | Проверено |\n|---|---|---|---|\n${rows.join('\n')}\n`;
});

writeFileSync(
  out,
  `# VI-строки на вычитку носителем\n\n` +
    `Сгенерировано \`node docs/tools/vi-review.mjs\` из \`packages/i18n/locales/vi\`. Ключей: ${total}, вычитано: ${done}.\n\n` +
    `Как вычитывать: правьте текст в \`packages/i18n/locales/vi/<раздел>.json\` (или в админке → «Тексты», это переопределение поверх файла), ` +
    `в колонке «Проверено» ставьте имя и дату, затем пересоберите файл — отметки сохранятся. Термины — \`packages/i18n/glossary.md\`. ` +
    `Плейсхолдеры \`{code}\`, \`{count, plural, …}\` не переводятся.\n\n` +
    sections.join('\n'),
);
console.log(`[vi-review] ${total} ключей, вычитано ${done} → docs/i18n-vi-review.md`);
