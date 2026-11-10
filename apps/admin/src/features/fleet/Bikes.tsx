import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { pickText } from '@rental/i18n';
import { FileText, KeySquare, Plus, Upload } from 'lucide-react';
import { BIKE_STATUSES, type Lang, type AdminBike, type AdminBikeInput, type AdminListOf, type AdminModel, type BikeDocKind, type BikeDocUpload, type BikeStatus, type DocumentUrlResponse } from '@rental/shared';
import { Badge, Button, EmptyState, Icon, Sheet, type BadgeTone } from '@rental/ui';
import { api } from '@/app/providers';
import { Alert, DataTable, Field, inputClass, td, th, useFormat, useToast } from '@/app/ui';
import { DemoTag, LoadGate, Meta, NumberInput, putSigned, useAdminGet, useAdminSave, useFleetErrorText } from './kit';

const STATUS_TONE: Record<BikeStatus, BadgeTone> = { ACTIVE: 'success', REPAIR: 'warning', RETIRED: 'neutral' };
const DOC_ACCEPT = 'application/pdf,image/jpeg,image/png,image/webp,image/heic';
const DAY = 86_400_000;

/** ISO → значение <input type="date"> (дата в UTC — для ТО и страховки время не важно). */
const toDateInput = (iso: string | null) => (iso ? iso.slice(0, 10) : '');
const fromDateInput = (v: string) => (v ? new Date(`${v}T00:00:00Z`).toISOString() : null);

/** Документ байка: загрузка в приватное хранилище и просмотр по временной ссылке (≤ 10 мин). */
function DocRow({ bike, kind, has: stored, canUpload }: { bike: AdminBike; kind: BikeDocKind; has: boolean; canUpload: boolean }) {
  const { t } = useTranslation();
  const [uploaded, setUploaded] = useState(false);
  const has = stored || uploaded;
  const toast = useToast();
  const errorText = useFleetErrorText();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const save = useAdminSave(async (file: File) => {
    const up = await api.post<BikeDocUpload>(`/admin/bikes/${bike.id}/documents/${kind}`, { contentType: file.type });
    await putSigned(up.uploadUrl, up.headers, file);
    await api.post(`/admin/bikes/${bike.id}/documents/${kind}/confirm`, { key: up.key });
  }, { success: t('admin-fleet.bikes.docUploaded'), invalidate: ['/admin/bikes'] });
  const open = async () => {
    setBusy(true);
    setError(null);
    // Окно открываем до запроса: после await браузер телефона его заблокирует
    const tab = window.open('', '_blank');
    try {
      const r = await api.get<DocumentUrlResponse>(`/admin/bikes/${bike.id}/documents/${kind}/url`);
      if (tab) tab.location.href = r.url;
      else window.location.assign(r.url);
    } catch (e) {
      tab?.close();
      setError(errorText(e));
      toast('danger', errorText(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex flex-col gap-2 rounded-md border border-line p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-body-strong">
          <Icon icon={FileText} size={20} />
          {t(`admin-fleet.bikes.doc.${kind}`)}
        </span>
        <span className="text-caption text-ink-muted">{has ? t('admin-fleet.bikes.docUploadedState') : t('admin-fleet.bikes.docMissing')}</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {has && (
          <Button size="sm" variant="secondary" loading={busy} onClick={() => void open()}>
            {t('admin-fleet.bikes.docOpen')}
          </Button>
        )}
        {canUpload && (
          <label className="relative inline-flex h-control-sm cursor-pointer items-center gap-2 rounded-sm px-2 text-button text-accent-text [&:has(:focus-visible)]:outline [&:has(:focus-visible)]:outline-2 [&:has(:focus-visible)]:outline-focus-ring" aria-busy={save.isLoading || undefined}>
            <Icon icon={Upload} size={16} />
            {save.isLoading ? t('admin-fleet.common.uploading') : has ? t('admin-fleet.bikes.docReplace') : t('admin-fleet.bikes.docUpload')}
            <input
              type="file"
              accept={DOC_ACCEPT}
              className="sr-only"
              disabled={save.isLoading}
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = '';
                if (f) save.mutate(f, { onSuccess: () => setUploaded(true) });
              }}
            />
          </label>
        )}
      </div>
      {(save.error ?? error) && <Alert>{save.error ?? error}</Alert>}
    </div>
  );
}

function BikeSheet({ bike, models, isAdmin, onClose }: { bike: AdminBike | null; models: AdminModel[]; isAdmin: boolean; onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const [d, setD] = useState<AdminBikeInput>(() => ({
    modelId: bike?.modelId ?? models[0]?.id ?? '',
    plate: bike?.plate ?? '',
    vin: bike?.vin ?? '',
    mileageKm: bike?.mileageKm ?? 0,
    status: bike?.status ?? 'ACTIVE',
    readyAt: bike?.readyAt ?? null,
    serviceDate: bike?.serviceDate ?? null,
    insuranceUntil: bike?.insuranceUntil ?? null,
    purchasePrice: bike?.purchasePrice ?? null,
  }));
  const set = (p: Partial<AdminBikeInput>) => setD((x) => ({ ...x, ...p }));
  const save = useAdminSave((body: AdminBikeInput) => (bike ? api.patch<AdminBike>(`/admin/bikes/${bike.id}`, body) : api.post<AdminBike>('/admin/bikes', body)), {
    success: t('admin-fleet.common.saved'),
    invalidate: ['/admin/bikes', '/admin/models'],
  });
  const valid = !!d.modelId && !!d.plate?.trim() && d.mileageKm !== null && (d.mileageKm ?? 0) >= 0;
  const submit = () => {
    const body: AdminBikeInput = isAdmin
      ? { ...d, plate: d.plate?.trim(), vin: d.vin?.trim() || null }
      : { status: d.status, readyAt: d.status === 'REPAIR' ? d.readyAt : null, mileageKm: d.mileageKm, serviceDate: d.serviceDate };
    save.mutate(body, { onSuccess: onClose });
  };

  return (
    <Sheet
      open
      onClose={onClose}
      title={bike ? bike.plate : t('admin-fleet.bikes.new')}
      closeLabel={t('admin.common.close')}
      className="sm:max-w-[640px]"
      footer={
        <Button block size="lg" loading={save.isLoading} disabled={!valid} onClick={submit}>
          {bike ? t('admin-fleet.common.save') : t('admin-fleet.bikes.create')}
        </Button>
      }
    >
      <div className="flex flex-col gap-5 pb-2">
        {save.error && <Alert>{save.error}</Alert>}
        {!isAdmin && <p className="text-caption text-ink-muted">{t('admin-fleet.bikes.managerHint')}</p>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('admin-fleet.bikes.model')} htmlFor="b-model">
            <select id="b-model" value={d.modelId} disabled={!isAdmin} onChange={(e) => set({ modelId: e.target.value })} className={inputClass}>
              {models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} · {pickText(m.locationName, i18n.language as Lang)}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t('admin-fleet.bikes.plate')} htmlFor="b-plate">
            <input id="b-plate" value={d.plate ?? ''} disabled={!isAdmin} maxLength={20} onChange={(e) => set({ plate: e.target.value })} className={`${inputClass} tabular uppercase`} />
          </Field>
          <Field label={t('admin-fleet.bikes.vin')} htmlFor="b-vin">
            <input id="b-vin" value={d.vin ?? ''} disabled={!isAdmin} maxLength={40} onChange={(e) => set({ vin: e.target.value })} className={`${inputClass} tabular uppercase`} />
          </Field>
          <Field label={t('admin-fleet.bikes.mileage')} htmlFor="b-km">
            <NumberInput id="b-km" value={d.mileageKm} min={0} suffix={t('admin-fleet.units.km')} onChange={(v) => set({ mileageKm: v ?? 0 })} />
          </Field>
          <Field label={t('admin-fleet.bikes.status')} htmlFor="b-status">
            <select id="b-status" value={d.status} onChange={(e) => set({ status: e.target.value as BikeStatus })} className={inputClass}>
              {BIKE_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {t(`admin-fleet.bikeStatus.${s}`)}
                </option>
              ))}
            </select>
          </Field>
          {d.status === 'REPAIR' && (
            <Field label={t('admin-fleet.bikes.readyAt')} htmlFor="b-ready" hint={t('admin-fleet.bikes.readyAtHint')}>
              <input id="b-ready" type="date" value={toDateInput(d.readyAt ?? null)} onChange={(e) => set({ readyAt: fromDateInput(e.target.value) })} className={`${inputClass} tabular`} />
            </Field>
          )}
          <Field label={t('admin-fleet.bikes.serviceDate')} htmlFor="b-service">
            <input id="b-service" type="date" value={toDateInput(d.serviceDate ?? null)} onChange={(e) => set({ serviceDate: fromDateInput(e.target.value) })} className={`${inputClass} tabular`} />
          </Field>
          <Field label={t('admin-fleet.bikes.insuranceUntil')} htmlFor="b-ins">
            <input id="b-ins" type="date" value={toDateInput(d.insuranceUntil ?? null)} disabled={!isAdmin} onChange={(e) => set({ insuranceUntil: fromDateInput(e.target.value) })} className={`${inputClass} tabular`} />
          </Field>
          {isAdmin && (
            <Field label={t('admin-ops.finance.purchase')} htmlFor="b-price" hint={t('admin-ops.finance.purchaseHint')}>
              <NumberInput id="b-price" value={d.purchasePrice} min={0} suffix="₫" onChange={(v) => set({ purchasePrice: v })} />
            </Field>
          )}
        </div>
        {bike && (
          <section className="flex flex-col gap-2" aria-label={t('admin-fleet.bikes.documents')}>
            <h3 className="text-headline">{t('admin-fleet.bikes.documents')}</h3>
            <DocRow bike={bike} kind="registration" has={bike.hasRegistrationDoc} canUpload={isAdmin} />
            <DocRow bike={bike} kind="insurance" has={bike.hasInsuranceDoc} canUpload={isAdmin} />
            <p className="text-caption text-ink-muted">{t('admin-fleet.bikes.docsPrivate')}</p>
          </section>
        )}
      </div>
    </Sheet>
  );
}

/** Сколько осталось до даты: просрочено — danger, меньше 30 дней — warning. */
function DueBadge({ iso }: { iso: string | null }) {
  const { t } = useTranslation();
  const f = useFormat();
  if (!iso) return <span className="text-ink-muted">—</span>;
  const left = new Date(iso).getTime() - Date.now();
  const tone: BadgeTone | null = left < 0 ? 'danger' : left < 30 * DAY ? 'warning' : null;
  return tone ? (
    <Badge tone={tone} plain>
      {f.date(iso)}
      <span className="sr-only"> — {t(left < 0 ? 'admin-fleet.bikes.overdue' : 'admin-fleet.bikes.soon')}</span>
    </Badge>
  ) : (
    <span className="tabular">{f.date(iso)}</span>
  );
}

export function Bikes({ isAdmin }: { isAdmin: boolean }) {
  const { t } = useTranslation();
  const f = useFormat();
  const bikes = useAdminGet<AdminListOf<AdminBike>>('/admin/bikes');
  const models = useAdminGet<AdminListOf<AdminModel>>('/admin/models');
  const [open, setOpen] = useState<AdminBike | 'new' | null>(null);
  const rows = bikes.data?.items ?? [];

  return (
    <>
      {isAdmin && (
        <div className="mb-4 flex justify-end">
          <Button variant="secondary" icon={Plus} disabled={!models.data?.items.length} onClick={() => setOpen('new')}>
            {t('admin-fleet.bikes.add')}
          </Button>
        </div>
      )}
      <LoadGate isLoading={bikes.isLoading} isError={bikes.isError} onRetry={() => void bikes.refetch()}>
        {rows.length === 0 ? (
          <EmptyState icon={KeySquare} title={t('admin-fleet.bikes.empty')} text={t('admin-fleet.bikes.emptyText')} className="py-12" />
        ) : (
          <>
            <div className="hidden rounded-lg border border-line bg-surface-raised px-4 md:block">
              <DataTable
                label={t('admin-fleet.fleet.tab.bikes')}
                head={
                  <>
                    <th className={th}>{t('admin-fleet.bikes.plate')}</th>
                    <th className={th}>{t('admin-fleet.bikes.model')}</th>
                    <th className={th}>{t('admin-fleet.bikes.status')}</th>
                    <th className={`${th} text-right`}>{t('admin-fleet.bikes.mileage')}</th>
                    <th className={th}>{t('admin-fleet.bikes.serviceDate')}</th>
                    <th className={th}>{t('admin-fleet.bikes.insuranceUntil')}</th>
                    <th className={th}>{t('admin-fleet.bikes.documents')}</th>
                  </>
                }
              >
                {rows.map((b) => (
                  <tr key={b.id} className="cursor-pointer hover:bg-surface" onClick={() => setOpen(b)}>
                    <td className={td}>
                      <button type="button" className="text-body-strong text-accent-text underline-offset-4 tabular hover:underline" onClick={() => setOpen(b)}>
                        {b.plate}
                      </button>
                      {b.vin && <span className="block text-caption text-ink-muted tabular">{b.vin}</span>}
                    </td>
                    <td className={td}>{b.modelName}</td>
                    <td className={td}>
                      <span className="flex flex-wrap items-center gap-1.5">
                        <Badge tone={STATUS_TONE[b.status]}>{t(`admin-fleet.bikeStatus.${b.status}`)}</Badge>
                        <DemoTag show={b.isDemo} />
                      </span>
                      {b.status === 'REPAIR' && b.readyAt && <span className="mt-1 block text-caption text-ink-muted">{t('admin-fleet.bikes.readyOn', { date: f.date(b.readyAt) })}</span>}
                    </td>
                    <td className={`${td} whitespace-nowrap text-right tabular`}>{t('admin-fleet.bikes.km', { km: b.mileageKm.toLocaleString(f.lang) })}</td>
                    <td className={`${td} whitespace-nowrap`}>
                      <DueBadge iso={b.serviceDate} />
                    </td>
                    <td className={`${td} whitespace-nowrap`}>
                      <DueBadge iso={b.insuranceUntil} />
                    </td>
                    <td className={`${td} text-caption text-ink-muted`}>{[b.hasRegistrationDoc && t('admin-fleet.bikes.doc.registration'), b.hasInsuranceDoc && t('admin-fleet.bikes.doc.insurance')].filter(Boolean).join(', ') || t('admin-fleet.bikes.noDocs')}</td>
                  </tr>
                ))}
              </DataTable>
            </div>
            <ul className="flex flex-col gap-2 md:hidden">
              {rows.map((b) => (
                <li key={b.id}>
                  <button type="button" onClick={() => setOpen(b)} className="block w-full rounded-lg border border-line bg-surface-raised p-4 text-left active:bg-surface">
                    <span className="flex items-start justify-between gap-3">
                      <span className="text-body-strong tabular">{b.plate}</span>
                      <Badge tone={STATUS_TONE[b.status]}>{t(`admin-fleet.bikeStatus.${b.status}`)}</Badge>
                    </span>
                    <span className="mt-1 block text-body">{b.modelName}</span>
                    <span className="mt-2 flex flex-col gap-1">
                      <Meta label={t('admin-fleet.bikes.mileage')}>{t('admin-fleet.bikes.km', { km: b.mileageKm.toLocaleString(f.lang) })}</Meta>
                      <Meta label={t('admin-fleet.bikes.serviceDate')}>{b.serviceDate ? f.date(b.serviceDate) : '—'}</Meta>
                      <Meta label={t('admin-fleet.bikes.insuranceUntil')}>{b.insuranceUntil ? f.date(b.insuranceUntil) : '—'}</Meta>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </LoadGate>
      {open && <BikeSheet bike={open === 'new' ? null : open} models={models.data?.items ?? []} isAdmin={isAdmin} onClose={() => setOpen(null)} />}
    </>
  );
}
