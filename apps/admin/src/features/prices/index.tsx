import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CalendarRange, Plus, Trash2 } from 'lucide-react';
import type { AdminExtra, AdminExtraInput, AdminListOf, AdminModelTariffs, AdminSeason, AdminSeasonInput, AdminSettingsResponse, AdminTariff, I18nText } from '@rental/shared';
import { Badge, Button, EmptyState, IconButton, Sheet } from '@rental/ui';
import { api } from '@/app/providers';
import { Alert, DataTable, Field, inputClass, PageHeader, Panel, td, th, useFormat, useMe } from '@/app/ui';
import { DemoTag, I18nTextField, LoadGate, NumberInput, useAdminGet, useAdminSave } from '@/features/fleet/kit';
import { addTariffRow, tariffProblem, type TariffRow } from './tariffs';

type Row = TariffRow;

function TariffEditor({ item }: { item: AdminModelTariffs }) {
  const { t } = useTranslation();
  const [rows, setRows] = useState<Row[]>(item.tariffs);
  const [deposit, setDeposit] = useState<number | null>(item.deposit);
  const save = useAdminSave((v: { tariffs: AdminTariff[]; deposit: number }) => api.patch<AdminModelTariffs>(`/admin/tariffs/${item.modelId}`, v), {
    success: t('admin-fleet.prices.tariffsSaved', { model: item.modelName }),
    invalidate: ['/admin/tariffs', '/admin/models'],
  });
  const problem = tariffProblem(rows);
  const dirty = JSON.stringify(rows) !== JSON.stringify(item.tariffs) || deposit !== item.deposit;
  const update = (i: number, p: Partial<Row>) => setRows((l) => l.map((r, j) => (j === i ? { ...r, ...p } : r)));

  return (
    <Panel
      title={item.modelName}
      actions={<DemoTag show={item.isDemo} />}
    >
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-[56px_56px_minmax(0,1fr)_44px] sm:grid-cols-[repeat(3,minmax(0,1fr))_44px] items-end gap-2 text-caption font-bold text-ink-muted" aria-hidden>
          <span>{t('admin-fleet.prices.fromDays')}</span>
          <span>{t('admin-fleet.prices.toDays')}</span>
          <span>{t('admin-fleet.prices.perDay')}</span>
          <span />
        </div>
        {rows.map((r, i) => (
          <div key={i} className="grid grid-cols-[56px_56px_minmax(0,1fr)_44px] sm:grid-cols-[repeat(3,minmax(0,1fr))_44px] items-center gap-2">
            <label className="sr-only" htmlFor={`${item.modelId}-min-${i}`}>
              {t('admin-fleet.prices.fromDays')}
            </label>
            <NumberInput id={`${item.modelId}-min-${i}`} value={r.minDays} min={1} onChange={(v) => update(i, { minDays: v })} />
            <label className="sr-only" htmlFor={`${item.modelId}-max-${i}`}>
              {t('admin-fleet.prices.toDays')}
            </label>
            <NumberInput id={`${item.modelId}-max-${i}`} value={r.maxDays} min={1} onChange={(v) => update(i, { maxDays: v })} />
            <label className="sr-only" htmlFor={`${item.modelId}-price-${i}`}>
              {t('admin-fleet.prices.perDay')}
            </label>
            <NumberInput id={`${item.modelId}-price-${i}`} value={r.pricePerDay} min={0} step={5000} suffix="₫" onChange={(v) => update(i, { pricePerDay: v })} />
            <IconButton icon={Trash2} variant="surface" label={t('admin-fleet.prices.removeRow')} disabled={rows.length === 1} onClick={() => setRows((l) => l.filter((_, j) => j !== i))} />
          </div>
        ))}
        <p className="text-caption text-ink-muted">{t('admin-fleet.prices.openHint')}</p>
        <div className="flex flex-wrap items-end gap-3">
          <Button
            size="sm"
            variant="ghost"
            icon={Plus}
            onClick={() =>
              setRows(addTariffRow)
            }
          >
            {t('admin-fleet.prices.addRow')}
          </Button>
          <div className="ml-auto w-48">
            <Field label={t('admin-fleet.models.deposit')} htmlFor={`${item.modelId}-dep`}>
              <NumberInput id={`${item.modelId}-dep`} value={deposit} min={0} step={10000} suffix="₫" onChange={setDeposit} />
            </Field>
          </div>
        </div>
        {problem && dirty && <Alert tone="warning">{t(`admin-fleet.prices.problem.${problem}`)}</Alert>}
        {save.error && <Alert>{save.error}</Alert>}
        <div className="flex justify-end">
          <Button
            variant={dirty ? 'primary' : 'secondary'}
            disabled={!dirty || !!problem || deposit === null}
            loading={save.isLoading}
            onClick={() => save.mutate({ tariffs: rows as AdminTariff[], deposit: deposit ?? 0 })}
          >
            {t('admin-fleet.common.save')}
          </Button>
        </div>
      </div>
    </Panel>
  );
}

function SeasonSheet({ season, onClose }: { season: AdminSeason | null; onClose: () => void }) {
  const { t } = useTranslation();
  const [d, setD] = useState<{ name: Partial<I18nText>; from: string; to: string; coefficient: number | null }>({
    name: season?.name ?? {},
    from: season?.from ?? '',
    to: season?.to ?? '',
    coefficient: season?.coefficient ?? 1.2,
  });
  const save = useAdminSave((v: AdminSeasonInput) => (season ? api.patch(`/admin/seasons/${season.id}`, v) : api.post('/admin/seasons', v)), {
    success: t('admin-fleet.common.saved'),
    invalidate: ['/admin/seasons'],
  });
  const remove = useAdminSave(() => api.del(`/admin/seasons/${season!.id}`), { success: t('admin-fleet.prices.seasonDeleted'), invalidate: ['/admin/seasons'] });
  const valid = !!d.name.en?.trim() && !!d.from && !!d.to && d.from <= d.to && !!d.coefficient && d.coefficient > 0;
  return (
    <Sheet
      open
      onClose={onClose}
      title={season ? t('admin-fleet.prices.editSeason') : t('admin-fleet.prices.newSeason')}
      closeLabel={t('admin.common.close')}
      footer={
        <div className="flex gap-2">
          {season && (
            <Button variant="secondary" loading={remove.isLoading} onClick={() => window.confirm(t('admin-fleet.prices.deleteSeasonConfirm')) && remove.mutate(undefined, { onSuccess: onClose })}>
              {t('admin-fleet.common.delete')}
            </Button>
          )}
          <Button block size="lg" disabled={!valid} loading={save.isLoading} onClick={() => save.mutate({ name: d.name as I18nText, from: d.from, to: d.to, coefficient: d.coefficient! }, { onSuccess: onClose })}>
            {t('admin-fleet.common.save')}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4 pb-2">
        {(save.error ?? remove.error) && <Alert>{save.error ?? remove.error}</Alert>}
        <I18nTextField label={t('admin-fleet.prices.seasonName')} value={d.name} onChange={(name) => setD({ ...d, name })} maxLength={80} />
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('admin-fleet.prices.seasonFrom')} htmlFor="s-from">
            <input id="s-from" type="date" value={d.from} onChange={(e) => setD({ ...d, from: e.target.value })} className={`${inputClass} tabular`} />
          </Field>
          <Field label={t('admin-fleet.prices.seasonTo')} htmlFor="s-to">
            <input id="s-to" type="date" value={d.to} min={d.from || undefined} onChange={(e) => setD({ ...d, to: e.target.value })} className={`${inputClass} tabular`} />
          </Field>
        </div>
        <Field label={t('admin-fleet.prices.coefficient')} htmlFor="s-k" hint={t('admin-fleet.prices.coefficientHint')}>
          <NumberInput id="s-k" value={d.coefficient} min={0.1} max={10} step={0.05} suffix="×" onChange={(coefficient) => setD({ ...d, coefficient })} />
        </Field>
      </div>
    </Sheet>
  );
}

function ExtraSheet({ extra, onClose }: { extra: AdminExtra | null; onClose: () => void }) {
  const { t } = useTranslation();
  const [d, setD] = useState<{ code: string; name: Partial<I18nText>; price: number | null; per: 'DAY' | 'ONCE'; maxQty: number | null; isActive: boolean }>({
    code: extra?.code ?? '',
    name: extra?.name ?? {},
    price: extra?.price ?? null,
    per: extra?.per ?? 'DAY',
    maxQty: extra?.maxQty ?? 1,
    isActive: extra?.isActive ?? true,
  });
  const save = useAdminSave((v: AdminExtraInput) => (extra ? api.patch(`/admin/extras/${extra.id}`, v) : api.post('/admin/extras', v)), { success: t('admin-fleet.common.saved'), invalidate: ['/admin/extras'] });
  const valid = !!d.code.trim() && !!d.name.en?.trim() && d.price !== null && d.price >= 0 && !!d.maxQty;
  return (
    <Sheet
      open
      onClose={onClose}
      title={extra ? extra.name.en : t('admin-fleet.prices.newExtra')}
      closeLabel={t('admin.common.close')}
      footer={
        <Button block size="lg" disabled={!valid} loading={save.isLoading} onClick={() => save.mutate({ code: d.code.trim(), name: d.name as I18nText, price: d.price!, per: d.per, maxQty: d.maxQty!, isActive: d.isActive }, { onSuccess: onClose })}>
          {t('admin-fleet.common.save')}
        </Button>
      }
    >
      <div className="flex flex-col gap-4 pb-2">
        {save.error && <Alert>{save.error}</Alert>}
        <Field label={t('admin-fleet.prices.extraCode')} htmlFor="x-code" hint={t('admin-fleet.prices.extraCodeHint')}>
          <input id="x-code" value={d.code} maxLength={40} onChange={(e) => setD({ ...d, code: e.target.value })} className={`${inputClass} uppercase tabular`} />
        </Field>
        <I18nTextField label={t('admin-fleet.prices.extraName')} value={d.name} onChange={(name) => setD({ ...d, name })} maxLength={80} />
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('admin-fleet.prices.extraPrice')} htmlFor="x-price">
            <NumberInput id="x-price" value={d.price} min={0} step={5000} suffix="₫" onChange={(price) => setD({ ...d, price })} />
          </Field>
          <Field label={t('admin-fleet.prices.extraPer')} htmlFor="x-per">
            <select id="x-per" value={d.per} onChange={(e) => setD({ ...d, per: e.target.value as 'DAY' | 'ONCE' })} className={inputClass}>
              <option value="DAY">{t('admin-fleet.prices.per.DAY')}</option>
              <option value="ONCE">{t('admin-fleet.prices.per.ONCE')}</option>
            </select>
          </Field>
          <Field label={t('admin-fleet.prices.extraMaxQty')} htmlFor="x-qty">
            <NumberInput id="x-qty" value={d.maxQty} min={1} max={10} onChange={(maxQty) => setD({ ...d, maxQty })} />
          </Field>
        </div>
        <label className="flex items-center gap-3 text-body">
          <input type="checkbox" checked={d.isActive} onChange={(e) => setD({ ...d, isActive: e.target.checked })} className="h-5 w-5 accent-[var(--accent)]" />
          {t('admin-fleet.prices.extraActive')}
        </label>
      </div>
    </Sheet>
  );
}

function Delivery() {
  const { t } = useTranslation();
  const q = useAdminGet<AdminSettingsResponse>('/admin/settings');
  const [fee, setFee] = useState<number | null | undefined>(undefined);
  const save = useAdminSave((v: number | null) => api.patch<AdminSettingsResponse>('/admin/settings', { deliveryFee: v }), { success: t('admin-fleet.common.saved'), invalidate: ['/admin/settings'] });
  const value = fee === undefined ? (q.data?.values.deliveryFee ?? null) : fee;
  return (
    <Panel title={t('admin-fleet.prices.delivery')} actions={<DemoTag show={!!q.data?.demo.includes('deliveryFee')} />}>
      <LoadGate isLoading={q.isLoading} isError={q.isError} onRetry={() => void q.refetch()} rows={1}>
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-56">
            <Field label={t('admin-fleet.prices.deliveryFee')} htmlFor="delivery-fee" hint={t('admin-fleet.prices.deliveryHint')}>
              <NumberInput id="delivery-fee" value={value} min={0} step={10000} suffix="₫" onChange={setFee} />
            </Field>
          </div>
          <Button variant="secondary" loading={save.isLoading} disabled={fee === undefined} onClick={() => save.mutate(value, { onSuccess: () => setFee(undefined) })}>
            {t('admin-fleet.common.save')}
          </Button>
        </div>
        {save.error && (
          <div className="mt-3">
            <Alert>{save.error}</Alert>
          </div>
        )}
      </LoadGate>
    </Panel>
  );
}

/** Цены: тарифы по длительности и депозит по моделям, сезонные коэффициенты, опции, доставка. Итог в Mini App меняется сразу. */
export default function Prices() {
  const { t } = useTranslation();
  const f = useFormat();
  const me = useMe();
  const isAdmin = me.role === 'ADMIN';
  // Общий сезон меняет цены всех точек: владелец его видит, правит только свои
  const canEditSeason = (s: AdminSeason) => isAdmin || s.locationId !== null;
  const tariffs = useAdminGet<AdminListOf<AdminModelTariffs>>('/admin/tariffs');
  const seasons = useAdminGet<AdminListOf<AdminSeason>>('/admin/seasons');
  const extras = useAdminGet<AdminListOf<AdminExtra>>('/admin/extras');
  const [season, setSeason] = useState<AdminSeason | 'new' | null>(null);
  const [extra, setExtra] = useState<AdminExtra | 'new' | null>(null);

  return (
    <>
      <PageHeader title={t('admin.nav.prices')} meta={t('admin-fleet.prices.meta')} />
      <div className="flex flex-col gap-8">
        <section aria-labelledby="tariffs-h" className="flex flex-col gap-3">
          <h2 id="tariffs-h" className="text-title-2">
            {t('admin-fleet.prices.tariffs')}
          </h2>
          <LoadGate isLoading={tariffs.isLoading} isError={tariffs.isError} onRetry={() => void tariffs.refetch()}>
            <div className="grid gap-4 lg:grid-cols-2">
              {(tariffs.data?.items ?? []).map((m) => (
                <TariffEditor key={`${m.modelId}-${JSON.stringify(m.tariffs)}-${m.deposit}`} item={m} />
              ))}
            </div>
          </LoadGate>
        </section>

        <Panel
          title={t('admin-fleet.prices.seasons')}
          actions={
            <Button size="sm" variant="ghost" icon={Plus} onClick={() => setSeason('new')}>
              {t('admin-fleet.prices.addSeason')}
            </Button>
          }
        >
          <LoadGate isLoading={seasons.isLoading} isError={seasons.isError} onRetry={() => void seasons.refetch()} rows={2}>
            {(seasons.data?.items.length ?? 0) === 0 ? (
              <EmptyState icon={CalendarRange} title={t('admin-fleet.prices.noSeasons')} text={t('admin-fleet.prices.noSeasonsText')} className="py-6" />
            ) : (
              <DataTable
                label={t('admin-fleet.prices.seasons')}
                head={
                  <>
                    <th className={th}>{t('admin-fleet.prices.seasonName')}</th>
                    <th className={th}>{t('admin-fleet.prices.period')}</th>
                    <th className={`${th} text-right`}>{t('admin-fleet.prices.coefficient')}</th>
                  </>
                }
              >
                {seasons.data!.items.map((s) => (
                  <tr key={s.id} className={canEditSeason(s) ? 'cursor-pointer hover:bg-surface' : undefined} onClick={canEditSeason(s) ? () => setSeason(s) : undefined}>
                    <td className={td}>
                      {canEditSeason(s) ? (
                        <button type="button" className="text-body-strong text-accent-text underline-offset-4 hover:underline" onClick={() => setSeason(s)}>
                          {s.name.en}
                        </button>
                      ) : (
                        <span className="text-body-strong">{s.name.en}</span>
                      )}{' '}
                      {s.locationId === null && !isAdmin && <Badge tone="neutral">{t('admin-fleet.prices.commonSeason')}</Badge>}{' '}
                      <DemoTag show={s.isDemo} />
                    </td>
                    <td className={`${td} whitespace-nowrap tabular`}>
                      {f.date(`${s.from}T12:00:00Z`)} — {f.date(`${s.to}T12:00:00Z`)}
                    </td>
                    <td className={`${td} text-right tabular`}>×{s.coefficient.toLocaleString(f.lang)}</td>
                  </tr>
                ))}
              </DataTable>
            )}
          </LoadGate>
        </Panel>

        <Panel
          title={t('admin-fleet.prices.extras')}
          actions={
            isAdmin && (
              <Button size="sm" variant="ghost" icon={Plus} onClick={() => setExtra('new')}>
                {t('admin-fleet.prices.addExtra')}
              </Button>
            )
          }
        >
          <LoadGate isLoading={extras.isLoading} isError={extras.isError} onRetry={() => void extras.refetch()} rows={2}>
            <DataTable
              label={t('admin-fleet.prices.extras')}
              head={
                <>
                  <th className={th}>{t('admin-fleet.prices.extraName')}</th>
                  <th className={`${th} text-right`}>{t('admin-fleet.prices.extraPrice')}</th>
                  <th className={th}>{t('admin-fleet.models.col.state')}</th>
                </>
              }
            >
              {(extras.data?.items ?? []).map((x) => (
                <tr key={x.id} className={isAdmin ? 'cursor-pointer hover:bg-surface' : undefined} onClick={isAdmin ? () => setExtra(x) : undefined}>
                  <td className={td}>
                    {isAdmin ? (
                      <button type="button" className="text-body-strong text-accent-text underline-offset-4 hover:underline" onClick={() => setExtra(x)}>
                        {x.name.en}
                      </button>
                    ) : (
                      <span className="text-body-strong">{x.name.en}</span>
                    )}
                    <span className="block text-caption text-ink-muted tabular">{x.code}</span>
                  </td>
                  <td className={`${td} whitespace-nowrap text-right tabular`}>
                    {f.money(x.price)} <span className="text-caption text-ink-muted">{t(`admin-fleet.prices.per.${x.per}`)}</span>
                  </td>
                  <td className={td}>
                    <span className="flex flex-wrap gap-1.5">
                      <Badge tone={x.isActive ? 'success' : 'neutral'}>{t(x.isActive ? 'admin-fleet.models.active' : 'admin-fleet.models.hidden')}</Badge>
                      <DemoTag show={x.isDemo} />
                    </span>
                  </td>
                </tr>
              ))}
            </DataTable>
          </LoadGate>
        </Panel>

        {isAdmin && <Delivery />}
      </div>
      {season && <SeasonSheet season={season === 'new' ? null : season} onClose={() => setSeason(null)} />}
      {extra && <ExtraSheet extra={extra === 'new' ? null : extra} onClose={() => setExtra(null)} />}
    </>
  );
}
