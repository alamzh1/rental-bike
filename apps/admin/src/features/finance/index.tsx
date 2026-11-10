import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router-dom';
import { Download, Plus, ReceiptText } from 'lucide-react';
import { toLocationDate, type AdminBike, type AdminExpense, type AdminFinanceSummary, type AdminListOf } from '@rental/shared';
import { Button, Chip, ChipGroup, cn, EmptyState } from '@rental/ui';
import { insideTelegram } from '@/app/telegram';
import { DataTable, Field, inputClass, PageHeader, Panel, td, th, useFormat } from '@/app/ui';
import { LoadGate, useAdminGet } from '@/features/fleet/kit';
import { FinanceChart } from './Chart';
import { ExpenseSheet } from './ExpenseSheet';
import { PRESETS, presetPeriod, toCsv, type Period, type Preset } from './period';

const BREAKDOWN = ['rent', 'extras', 'delivery', 'lateFees', 'deductions', 'cancellationFees', 'refunds'] as const;

function download(name: string, csv: string) {
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

/** Финансы: доход, расходы и прибыль за период; прибыль и окупаемость каждого байка; учёт расходов. */
export default function Finance() {
  const { t } = useTranslation();
  const f = useFormat();
  const [params, setParams] = useSearchParams();
  const today = toLocationDate(new Date(), f.tz);
  const [preset, setPreset] = useState<Preset | null>('thisMonth');
  const [period, setPeriod] = useState<Period>(() => presetPeriod('thisMonth', today));
  const [editing, setEditing] = useState<AdminExpense | 'new' | null>(null);
  const summary = useAdminGet<AdminFinanceSummary>('/admin/finance/summary', { ...period });
  const expenses = useAdminGet<AdminListOf<AdminExpense>>('/admin/finance/expenses', { ...period });
  const bikes = useAdminGet<AdminListOf<AdminBike>>('/admin/bikes');
  const s = summary.data;
  const presetBike = params.get('addExpense');

  useEffect(() => {
    if (presetBike) setEditing('new');
  }, [presetBike]);

  const closeSheet = () => {
    setEditing(null);
    if (presetBike) setParams('', { replace: true });
  };
  const choose = (p: Preset) => {
    setPreset(p);
    setPeriod(presetPeriod(p, today));
  };
  const setDate = (patch: Partial<Period>) => {
    setPreset(null);
    setPeriod((x) => ({ ...x, ...patch }));
  };
  const tick = (p: string) => (p.length === 7 ? `${p.slice(5)}.${p.slice(0, 4)}` : p.slice(8).replace(/^0/, ''));

  const exportCsv = () => {
    if (!s) return;
    const head = [t('admin-ops.finance.plate'), t('admin-ops.finance.model'), t('admin-ops.finance.bookings'), t('admin-ops.finance.days'), t('admin-ops.finance.load'), t('admin-ops.finance.income'), t('admin-ops.finance.expenses'), t('admin-ops.finance.profit'), t('admin-ops.finance.purchase'), t('admin-ops.finance.payback')];
    const rows = s.bikes.map((b) => [b.plate, b.modelName, b.bookings, b.rentedDays, b.loadPercent, b.income, b.expenses, b.profit, b.purchasePrice, b.paybackPercent]);
    const list = (expenses.data?.items ?? []).map((e) => [e.date, t(`admin-ops.category.${e.category}`), e.amount, e.bikePlate, e.comment]);
    download(
      `finance-${s.from}-${s.to}.csv`,
      toCsv([
        [t('admin-ops.finance.income'), s.income],
        [t('admin-ops.finance.expenses'), s.expenses],
        [t('admin-ops.finance.profit'), s.profit],
        [],
        head,
        ...rows,
        [],
        [t('admin-ops.expense.date'), t('admin-ops.expense.category'), t('admin-ops.expense.amount'), t('admin-ops.expense.bike'), t('admin-ops.expense.comment')],
        ...list,
      ]),
    );
  };

  return (
    <>
      <PageHeader
        title={t('admin.nav.finance')}
        meta={t('admin-ops.finance.meta')}
        actions={
          <>
            {/* В окне Telegram скачивание файла, созданного на странице, не работает */}
            {!insideTelegram() && (
              <Button variant="secondary" icon={Download} disabled={!s} onClick={exportCsv}>
                {t('admin-ops.finance.export')}
              </Button>
            )}
            <Button icon={Plus} onClick={() => setEditing('new')}>
              {t('admin-ops.expense.add')}
            </Button>
          </>
        }
      />

      <div className="mb-5 flex flex-wrap items-end gap-x-6 gap-y-3">
        <ChipGroup label={t('admin-ops.finance.period')} scroll className="flex gap-2">
          {PRESETS.map((p) => (
            <Chip key={p} selected={preset === p} onClick={() => choose(p)}>
              {t(`admin-ops.finance.preset.${p}`)}
            </Chip>
          ))}
        </ChipGroup>
        <div className="flex gap-2">
          <Field label={t('admin-ops.finance.from')} htmlFor="f-from">
            <input id="f-from" type="date" value={period.from} max={period.to} onChange={(e) => e.target.value && setDate({ from: e.target.value })} className={`${inputClass} tabular`} />
          </Field>
          <Field label={t('admin-ops.finance.to')} htmlFor="f-to">
            <input id="f-to" type="date" value={period.to} min={period.from} onChange={(e) => e.target.value && setDate({ to: e.target.value })} className={`${inputClass} tabular`} />
          </Field>
        </div>
      </div>

      <LoadGate isLoading={summary.isLoading} isError={summary.isError} onRetry={() => void summary.refetch()}>
        {s && (
          <div className="flex flex-col gap-6">
            <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line lg:grid-cols-4">
              <div className="bg-surface-raised p-4">
                <dt className="text-caption text-ink-muted">{t('admin-ops.finance.profit')}</dt>
                <dd className={cn('mt-1 text-title-1 tabular', s.profit < 0 && 'text-danger')}>{f.money(s.profit)}</dd>
                {s.marginPercent !== null && <dd className="text-caption text-ink-muted">{t('admin-ops.finance.margin', { pct: s.marginPercent })}</dd>}
              </div>
              <div className="bg-surface-raised p-4">
                <dt className="text-caption text-ink-muted">{t('admin-ops.finance.income')}</dt>
                <dd className="mt-1 text-title-1 tabular">{f.money(s.income)}</dd>
              </div>
              <div className="bg-surface-raised p-4">
                <dt className="text-caption text-ink-muted">{t('admin-ops.finance.expenses')}</dt>
                <dd className="mt-1 text-title-1 tabular">{f.money(s.expenses)}</dd>
              </div>
              <div className="bg-surface-raised p-4">
                <dt className="text-caption text-ink-muted">{t('admin-ops.finance.outstanding')}</dt>
                <dd className="mt-1 text-title-1 tabular">{f.money(s.outstanding)}</dd>
                <dd className="text-caption text-ink-muted">{t('admin-ops.finance.outstandingHint')}</dd>
              </div>
            </dl>

            <Panel title={t('admin-ops.finance.chart')}>
              <FinanceChart points={s.series} label={t('admin-ops.finance.chart')} tickLabel={tick} />
              <p className="mt-3 text-caption text-ink-muted">{t('admin-ops.finance.hint')}</p>
            </Panel>

            <div className="grid gap-6 lg:grid-cols-2">
              <Panel title={t('admin-ops.finance.incomeBy')}>
                <ul className="flex flex-col">
                  {BREAKDOWN.filter((k) => s.breakdown[k] !== 0).map((k) => (
                    <li key={k} className="flex justify-between gap-3 border-b border-line py-2 text-body last:border-0">
                      <span>{t(`admin-ops.finance.breakdown.${k}`)}</span>
                      <span className="tabular">{f.money(s.breakdown[k])}</span>
                    </li>
                  ))}
                  {s.income === 0 && <li className="text-body text-ink-muted">{t('admin-ops.finance.noIncome')}</li>}
                </ul>
              </Panel>
              <Panel title={t('admin-ops.finance.expensesBy')}>
                <ul className="flex flex-col">
                  {s.expensesByCategory.map((c) => (
                    <li key={c.category} className="flex justify-between gap-3 border-b border-line py-2 text-body last:border-0">
                      <span>{t(`admin-ops.category.${c.category}`)}</span>
                      <span className="tabular">{f.money(c.amount)}</span>
                    </li>
                  ))}
                  {s.expensesByCategory.length === 0 && <li className="text-body text-ink-muted">{t('admin-ops.finance.noExpenses')}</li>}
                </ul>
              </Panel>
            </div>

            <Panel title={t('admin-ops.finance.byBike')}>
              <DataTable
                label={t('admin-ops.finance.byBike')}
                head={
                  <>
                    <th className={th}>{t('admin-ops.finance.plate')}</th>
                    <th className={`${th} text-right`}>{t('admin-ops.finance.bookings')}</th>
                    <th className={`${th} text-right`}>{t('admin-ops.finance.load')}</th>
                    <th className={`${th} text-right`}>{t('admin-ops.finance.income')}</th>
                    <th className={`${th} text-right`}>{t('admin-ops.finance.expenses')}</th>
                    <th className={`${th} text-right`}>{t('admin-ops.finance.profit')}</th>
                    <th className={`${th} text-right`}>{t('admin-ops.finance.payback')}</th>
                  </>
                }
              >
                {s.bikes.map((b) => (
                  <tr key={b.bikeId}>
                    <td className={td}>
                      <Link to={`/tracking/${b.bikeId}`} className="whitespace-nowrap text-body-strong text-accent-text underline-offset-4 tabular hover:underline">
                        {b.plate}
                      </Link>
                      <span className="block text-caption text-ink-muted">{b.modelName}</span>
                    </td>
                    <td className={`${td} text-right tabular`}>{b.bookings}</td>
                    <td className={`${td} whitespace-nowrap text-right tabular`}>
                      {b.loadPercent} %<span className="block text-caption text-ink-muted">{t('admin-ops.finance.daysValue', { days: b.rentedDays })}</span>
                    </td>
                    <td className={`${td} whitespace-nowrap text-right tabular`}>{f.money(b.income)}</td>
                    <td className={`${td} whitespace-nowrap text-right tabular`}>{f.money(b.expenses)}</td>
                    <td className={cn(td, 'whitespace-nowrap text-right text-body-strong tabular', b.profit < 0 && 'text-danger')}>{f.money(b.profit)}</td>
                    <td className={`${td} whitespace-nowrap text-right tabular`}>{b.paybackPercent === null ? <span className="text-ink-muted">{t('admin-ops.finance.noPurchase')}</span> : `${b.paybackPercent} %`}</td>
                  </tr>
                ))}
              </DataTable>
              <p className="mt-3 text-caption text-ink-muted">{t('admin-ops.finance.paybackHint')}</p>
            </Panel>

            <Panel title={t('admin-ops.finance.expensesList')} bodyClassName={expenses.data?.items.length ? 'p-0' : undefined}>
              {!expenses.data?.items.length ? (
                <EmptyState icon={ReceiptText} title={t('admin-ops.expense.empty')} text={t('admin-ops.expense.emptyText')} className="py-8" />
              ) : (
                <ul>
                  {expenses.data.items.map((e) => (
                    <li key={e.id} className="border-b border-line last:border-0">
                      <button type="button" onClick={() => setEditing(e)} className="flex w-full flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3 text-left hover:bg-surface">
                        <span className="min-w-0">
                          <span className="text-body-strong">{t(`admin-ops.category.${e.category}`)}</span>
                          {e.bikePlate && <span className="text-body text-ink-muted tabular"> · {e.bikePlate}</span>}
                          <span className="block text-caption text-ink-muted">
                            {f.date(`${e.date}T12:00:00Z`)}
                            {e.comment && ` · ${e.comment}`}
                          </span>
                        </span>
                        <span className="text-price tabular">{f.money(e.amount)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>
        )}
      </LoadGate>
      {editing && <ExpenseSheet expense={editing === 'new' ? null : editing} bikes={bikes.data?.items ?? []} today={today} presetBikeId={presetBike} onClose={closeSheet} />}
    </>
  );
}
