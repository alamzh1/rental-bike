#!/usr/bin/env node
// Собирает CSS-переменные из design-system/tokens.json в src/tokens.generated.css.
// Источник истины — tokens.json; design-system/tokens.css из него же, но содержит лишние «}}»
// в классах типографики, и PostCSS его не разбирает. Поэтому импортируем сгенерированную копию.
// Запуск: node scripts/gen-tokens.mjs
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = join(root, '..', '..', 'design-system', 'tokens.json');
const outFile = join(root, 'src', 'tokens.generated.css');
const t = JSON.parse(readFileSync(source, 'utf8'));

const themed = [...t.color.tokens, ...t.shadow.tokens];
const theme = (id) => themed.map((tk) => `  --${tk.name}: ${tk.value[id]};`).join('\n');
const flat = [...t.spacing.tokens, ...t.radius.tokens, ...t.size.tokens].map((tk) => `  --${tk.name}: ${tk.value};`);
flat.push(`  --font-sans: ${t.type.families.sans};`);

const css =
  '/* Сгенерировано packages/ui/scripts/gen-tokens.mjs из design-system/tokens.json — не править руками. */\n' +
  `:root,\n[data-theme="light"] {\n  color-scheme: light;\n${theme('light')}\n}\n` +
  `[data-theme="dark"] {\n  color-scheme: dark;\n${theme('dark')}\n}\n` +
  `:root {\n${flat.join('\n')}\n}\n`;

const prev = existsSync(outFile) ? readFileSync(outFile, 'utf8') : '';
if (prev !== css) writeFileSync(outFile, css);
