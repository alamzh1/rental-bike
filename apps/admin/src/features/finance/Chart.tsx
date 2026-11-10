import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { AdminFinancePoint } from '@rental/shared';
import { useFormat } from '@/app/ui';

// Доход и расходы по периодам. Цвета — --chart-income и --chart-expense (проверены на дальтонизм и контраст в обеих темах).

const W = 720;
const H = 220;
const PAD = { top: 12, right: 8, bottom: 24, left: 8 };
const GAP = 2;
const TICKS = 6;

function roundedTop(x: number, y: number, w: number, h: number, r: number): string {
  const rad = Math.min(r, w / 2, h);
  return `M${x},${y + h}V${y + rad}Q${x},${y} ${x + rad},${y}H${x + w - rad}Q${x + w},${y} ${x + w},${y + rad}V${y + h}Z`;
}

export function FinanceChart({ points, label, tickLabel }: { points: AdminFinancePoint[]; label: string; tickLabel: (period: string) => string }) {
  const { t } = useTranslation();
  const f = useFormat();
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...points.flatMap((p) => [p.income, p.expenses]));
  const plotH = H - PAD.top - PAD.bottom;
  const band = (W - PAD.left - PAD.right) / Math.max(1, points.length);
  const barW = Math.max(1, Math.min(24, (band - GAP * 3) / 2));
  const y = (v: number) => (v / max) * plotH;
  const every = Math.max(1, Math.ceil(points.length / TICKS));
  const active = hover !== null ? points[hover] : null;

  return (
    <figure className="m-0">
      <figcaption className="mb-3 flex flex-wrap gap-4 text-caption text-ink-muted">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="h-2.5 w-2.5 rounded-[3px] bg-[var(--chart-income)]" />
          {t('admin-ops.finance.income')}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="h-2.5 w-2.5 rounded-[3px] bg-[var(--chart-expense)]" />
          {t('admin-ops.finance.expenses')}
        </span>
      </figcaption>
      <div className="relative">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} className="block h-auto w-full" onMouseLeave={() => setHover(null)}>
          <line x1={PAD.left} x2={W - PAD.right} y1={PAD.top + plotH} y2={PAD.top + plotH} className="stroke-line" strokeWidth={1} />
          {points.map((p, i) => {
            const cx = PAD.left + band * i + band / 2;
            const base = PAD.top + plotH;
            const incomeH = y(p.income);
            const expenseH = y(p.expenses);
            return (
              <g key={p.period}>
                {hover === i && <rect x={cx - band / 2} y={PAD.top} width={band} height={plotH} className="fill-surface" />}
                {p.income > 0 && <path d={roundedTop(cx - barW - GAP / 2, base - incomeH, barW, Math.max(1, incomeH), 4)} fill="var(--chart-income)" />}
                {p.expenses > 0 && <path d={roundedTop(cx + GAP / 2, base - expenseH, barW, Math.max(1, expenseH), 4)} fill="var(--chart-expense)" />}
                {i % every === 0 && (
                  <text x={cx} y={H - 6} textAnchor="middle" className="fill-ink-muted text-[11px]">
                    {tickLabel(p.period)}
                  </text>
                )}
                <rect x={cx - band / 2} y={0} width={band} height={H} fill="transparent" onMouseEnter={() => setHover(i)} onClick={() => setHover(i)} />
              </g>
            );
          })}
        </svg>
        {active && hover !== null && (
          <div
            role="status"
            className="pointer-events-none absolute top-0 z-10 w-max rounded-md bg-inverse px-3 py-2 text-caption text-on-inverse shadow-nav"
            style={hover < points.length / 2 ? { left: `${((PAD.left + band * (hover + 1)) / W) * 100}%` } : { right: `${((W - PAD.left - band * hover) / W) * 100}%` }}
          >
            <p className="font-bold">{tickLabel(active.period)}</p>
            <p className="tabular">{t('admin-ops.finance.income')}: {f.money(active.income)}</p>
            <p className="tabular">{t('admin-ops.finance.expenses')}: {f.money(active.expenses)}</p>
            <p className="tabular font-bold">{t('admin-ops.finance.profit')}: {f.money(active.profit)}</p>
          </div>
        )}
      </div>
      <details className="mt-3">
        <summary className="cursor-pointer text-caption text-accent-text">{t('admin-ops.finance.asTable')}</summary>
        <div className="mt-2 max-h-64 overflow-auto">
          <table className="w-full text-caption">
            <thead>
              <tr className="text-ink-muted">
                <th className="py-1">{t('admin-ops.finance.period')}</th>
                <th className="py-1 text-right">{t('admin-ops.finance.income')}</th>
                <th className="py-1 text-right">{t('admin-ops.finance.expenses')}</th>
                <th className="py-1 text-right">{t('admin-ops.finance.profit')}</th>
              </tr>
            </thead>
            <tbody>
              {points.map((p) => (
                <tr key={p.period} className="border-t border-line">
                  <td className="py-1">{tickLabel(p.period)}</td>
                  <td className="py-1 text-right tabular">{f.money(p.income)}</td>
                  <td className="py-1 text-right tabular">{f.money(p.expenses)}</td>
                  <td className="py-1 text-right tabular">{f.money(p.profit)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
