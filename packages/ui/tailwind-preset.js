// Tailwind-пресет из design-system/tokens.json. Значения — CSS-переменные из src/tokens.generated.css,
// поэтому смена data-theme на <html> перекрашивает всё без пересборки. Литеральных цветов нет.
import { readFileSync } from 'node:fs';

const tokens = JSON.parse(readFileSync(new URL('../../design-system/tokens.json', import.meta.url), 'utf8'));
const v = (name) => `var(--${name})`;

const colors = Object.fromEntries(tokens.color.tokens.map((t) => [t.name, v(t.name)]));
colors.transparent = 'transparent';
colors.current = 'currentColor';

// Сетка 4 pt: шаги дизайн-системы + кратные 4 для размеров, которых в ней нет.
// Полушаги 6/10/14 — только внутренние зазоры бейджей и чипов (как в components/bundle.css).
const spacing = { 0: '0px', px: '1px', 0.5: '2px', 1.5: '6px', 2.5: '10px', 3.5: '14px' };
for (const t of tokens.spacing.tokens) spacing[t.name.replace('space-', '')] = v(t.name);
for (const n of [7, 9, 10, 11, 14, 16, 18, 20, 24, 30, 40]) spacing[n] ??= `${n * 4}px`;
for (const t of tokens.size.tokens) spacing[t.name] = v(t.name); // control-sm/md/lg, tabbar-height

const borderRadius = { none: '0px', full: '9999px' };
for (const t of tokens.radius.tokens) borderRadius[t.name.replace('radius-', '')] = v(t.name);

const boxShadow = { none: 'none' };
for (const t of tokens.shadow.tokens) boxShadow[t.name.replace('shadow-', '')] = v(t.name);

// Типографика: text-display, text-title-1 … text-price-lg — размер, интерлиньяж, вес и трекинг одним классом.
const fontSize = {};
for (const group of tokens.type.groups) {
  for (const s of group.styles) {
    const extra = { lineHeight: s.lineHeight, fontWeight: String(s.fontWeight) };
    if (s.letterSpacing) extra.letterSpacing = s.letterSpacing;
    fontSize[s.name] = [s.fontSize, extra];
  }
}

/** @type {import('tailwindcss').Config} */
export default {
  content: [],
  darkMode: ['selector', '[data-theme="dark"]'],
  theme: {
    colors,
    spacing,
    borderRadius,
    boxShadow,
    fontSize,
    fontFamily: { sans: v('font-sans') },
    extend: {
      transitionDuration: { fast: '150ms', base: '200ms', slow: '250ms' },
      transitionTimingFunction: { out: 'cubic-bezier(0.22, 1, 0.36, 1)' },
      maxWidth: { app: '480px' },
      zIndex: { nav: '30', sheet: '40', toast: '50' },
      keyframes: {
        'sheet-in': { from: { transform: 'translateY(100%)' }, to: { transform: 'translateY(0)' } },
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
      },
      animation: {
        'sheet-in': 'sheet-in 250ms cubic-bezier(0.22, 1, 0.36, 1)',
        'fade-in': 'fade-in 200ms cubic-bezier(0.22, 1, 0.36, 1)',
      },
    },
  },
};
