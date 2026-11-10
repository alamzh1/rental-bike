import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Star, Trash2 } from 'lucide-react';
import {
  ADMIN_MODEL_CATEGORIES,
  ADMIN_TRANSMISSIONS,
  MODEL_FEATURES,
  type AdminBrand,
  type AdminListOf,
  type AdminLocation,
  type AdminModel,
  type AdminModelInput,
  type I18nText,
} from '@rental/shared';
import { Button, Chip, ChipGroup, IconButton, Sheet } from '@rental/ui';
import { selectedPoint } from '@/app/api';
import { api } from '@/app/providers';
import { Alert, Field, inputClass } from '@/app/ui';
import { DemoTag, I18nTextField, ImagePicker, LANG_ORDER, NumberInput, textareaClass, uploadFile, useAdminGet, useAdminSave } from './kit';

type Draft = Required<Pick<AdminModelInput, 'name' | 'brandId' | 'locationId' | 'category' | 'transmission' | 'licenseRequired' | 'features' | 'isActive' | 'seats'>> & {
  engineCc: number | null;
  year: number | null;
  fuelConsumption: number | null;
  tankLiters: number | null;
  maxSpeedKmh: number | null;
  deposit: number | null;
  description: Partial<I18nText>;
  conditions: Partial<I18nText>;
  /** Что входит: по строке на пункт, отдельно для каждого языка */
  included: Record<'ru' | 'en' | 'vi', string>;
};

function draftOf(m: AdminModel | null): Draft {
  const lines = (lang: 'ru' | 'en' | 'vi') => (m?.included ?? []).map((i) => i[lang] ?? '').join('\n');
  return {
    name: m?.name ?? '',
    brandId: m?.brandId ?? '',
    locationId: m?.locationId ?? '',
    category: m?.category ?? 'SCOOTER',
    transmission: m?.transmission ?? 'AUTOMATIC',
    licenseRequired: m?.licenseRequired ?? 'A1',
    features: m?.features ?? [],
    isActive: m?.isActive ?? true,
    seats: m?.seats ?? 2,
    engineCc: m?.engineCc ?? null,
    year: m?.year ?? null,
    fuelConsumption: m?.fuelConsumption ?? null,
    tankLiters: m?.tankLiters ?? null,
    maxSpeedKmh: m?.maxSpeedKmh ?? null,
    deposit: m?.deposit ?? null,
    description: m?.description ?? {},
    conditions: m?.conditions ?? {},
    included: { ru: lines('ru'), en: lines('en'), vi: lines('vi') },
  };
}

const clean = (t: Partial<I18nText>): I18nText | null => {
  const out = Object.fromEntries(Object.entries(t).filter(([, v]) => typeof v === 'string' && v.trim()).map(([k, v]) => [k, (v as string).trim()]));
  return Object.keys(out).length ? (out as I18nText) : null;
};

/** Пункты «что входит»: строки EN задают список, RU/VI — переводы по номеру строки. */
function includedOf(x: Draft['included']): I18nText[] {
  const split = (s: string) => s.split('\n').map((l) => l.trim());
  const en = split(x.en);
  const ru = split(x.ru);
  const vi = split(x.vi);
  return en.map((line, i) => ({ en: line, ...(ru[i] ? { ru: ru[i] } : {}), ...(vi[i] ? { vi: vi[i] } : {}) })).filter((i) => i.en);
}

/** Карточка модели: характеристики, тексты на 3 языках, депозит, фото (WebP/AVIF делает сервер). Тарифы — в «Ценах». */
export function ModelSheet({ model, onClose, onSaved }: { model: AdminModel | null; onClose: () => void; onSaved: (m: AdminModel) => void }) {
  const { t } = useTranslation();
  const [d, setD] = useState<Draft>(() => draftOf(model));
  const brands = useAdminGet<AdminListOf<AdminBrand>>('/admin/brands');
  const locations = useAdminGet<AdminListOf<AdminLocation>>('/admin/locations');
  const set = (p: Partial<Draft>) => setD((x) => ({ ...x, ...p }));
  const locationId = d.locationId || selectedPoint() || locations.data?.items[0]?.id || '';
  const brandId = d.brandId || brands.data?.items[0]?.id || '';

  const [latest, setLatest] = useState<AdminModel | null>(null);
  const save = useAdminSave(
    (body: AdminModelInput) => (model ? api.patch<AdminModel>(`/admin/models/${model.id}`, body) : api.post<AdminModel>('/admin/models', body)).then((r) => (setLatest(r), r)),
    { success: t('admin-fleet.common.saved'), invalidate: ['/admin/models', '/admin/tariffs'] },
  );
  const photo = useAdminSave((f: File) => uploadFile<AdminModel>(`/admin/models/${model!.id}/photos`, f).then((r) => (setLatest(r), r)), { success: t('admin-fleet.models.photoAdded'), invalidate: ['/admin/models'] });
  const photoAction = useAdminSave((v: { key: string; action: 'delete' | 'main' }) => api.patch<AdminModel>(`/admin/models/${model!.id}/photos`, v).then((r) => (setLatest(r), r)), { invalidate: ['/admin/models'] });
  const current = latest ?? model;

  const valid = d.name.trim() && brandId && locationId && d.description.en?.trim() && d.deposit !== null && d.deposit >= 0;
  const body = useMemo<AdminModelInput>(
    () => ({
      name: d.name.trim(),
      brandId,
      locationId,
      category: d.category,
      transmission: d.transmission,
      licenseRequired: d.licenseRequired,
      features: d.features,
      isActive: d.isActive,
      seats: d.seats,
      engineCc: d.engineCc,
      year: d.year,
      fuelConsumption: d.fuelConsumption,
      tankLiters: d.tankLiters,
      maxSpeedKmh: d.maxSpeedKmh,
      deposit: d.deposit ?? 0,
      description: clean(d.description) ?? { en: '' },
      conditions: clean(d.conditions),
      included: includedOf(d.included),
    }),
    [d, brandId, locationId],
  );

  const submit = () => save.mutate(body, { onSuccess: (m) => onSaved(m) });
  const error = save.error ?? photo.error ?? photoAction.error;

  return (
    <Sheet
      open
      onClose={onClose}
      title={model ? model.name : t('admin-fleet.models.new')}
      closeLabel={t('admin.common.close')}
      className="sm:max-w-[720px]"
      footer={
        <Button block size="lg" loading={save.isLoading} disabled={!valid} onClick={submit}>
          {model ? t('admin-fleet.common.save') : t('admin-fleet.models.create')}
        </Button>
      }
    >
      <div className="flex flex-col gap-6 pb-2">
        {current?.isDemo && (
          <p className="flex items-center gap-2 text-caption text-ink-muted">
            <DemoTag /> {t('admin-fleet.common.demoHint')}
          </p>
        )}
        {error && <Alert>{error}</Alert>}

        {current && (
          <section className="flex flex-col gap-3" aria-labelledby="photos-h">
            <h3 id="photos-h" className="text-headline">
              {t('admin-fleet.models.photos')}
            </h3>
            {current.photos.length === 0 ? (
              <p className="text-body text-ink-muted">{t('admin-fleet.models.noPhotos')}</p>
            ) : (
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {current.photos.map((p, i) => (
                  <li key={p.key} className="relative overflow-hidden rounded-md bg-surface">
                    <img src={p.sizes['400']?.webp ?? p.url} alt="" className="aspect-[4/3] w-full object-contain" loading="lazy" />
                    <span className="absolute left-2 top-2 flex gap-1">
                      {i === 0 && <span className="rounded-pill bg-inverse px-2.5 py-0.5 text-label text-on-inverse">{t('admin-fleet.models.mainPhoto')}</span>}
                      <DemoTag show={p.demo} />
                    </span>
                    <span className="absolute bottom-2 right-2 flex gap-1">
                      {i > 0 && <IconButton icon={Star} variant="surface" label={t('admin-fleet.models.makeMain')} onClick={() => photoAction.mutate({ key: p.key, action: 'main' })} />}
                      <IconButton icon={Trash2} variant="surface" label={t('admin-fleet.models.deletePhoto')} onClick={() => window.confirm(t('admin-fleet.models.deletePhotoConfirm')) && photoAction.mutate({ key: p.key, action: 'delete' })} />
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex flex-wrap items-center gap-3">
              <ImagePicker label={photo.isLoading ? t('admin-fleet.models.photoConverting') : t('admin-fleet.models.addPhoto')} loading={photo.isLoading} onPick={(f) => photo.mutate(f)} />
              <span className="text-caption text-ink-muted">{t('admin-fleet.models.photoHint')}</span>
            </div>
          </section>
        )}

        <section className="grid gap-4 sm:grid-cols-2" aria-label={t('admin-fleet.models.main')}>
          <Field label={t('admin-fleet.models.name')} htmlFor="m-name">
            <input id="m-name" value={d.name} maxLength={80} onChange={(e) => set({ name: e.target.value })} className={inputClass} />
          </Field>
          <Field label={t('admin-fleet.models.brand')} htmlFor="m-brand" hint={brands.data?.items.length ? undefined : t('admin-fleet.models.brandHint')}>
            <select id="m-brand" value={brandId} onChange={(e) => set({ brandId: e.target.value })} className={inputClass}>
              {(brands.data?.items ?? []).map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </Field>
          {(locations.data?.items.length ?? 0) > 1 && !selectedPoint() && (
            <Field label={t('admin-fleet.models.location')} htmlFor="m-loc">
              <select id="m-loc" value={locationId} onChange={(e) => set({ locationId: e.target.value })} className={inputClass}>
                {(locations.data?.items ?? []).map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name.en}
                  </option>
                ))}
              </select>
            </Field>
          )}
          <Field label={t('admin-fleet.models.category')} htmlFor="m-cat">
            <select id="m-cat" value={d.category} onChange={(e) => set({ category: e.target.value as Draft['category'] })} className={inputClass}>
              {ADMIN_MODEL_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {t(`admin-fleet.category.${c}`)}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t('admin-fleet.models.transmission')} htmlFor="m-tr">
            <select id="m-tr" value={d.transmission} onChange={(e) => set({ transmission: e.target.value as Draft['transmission'] })} className={inputClass}>
              {ADMIN_TRANSMISSIONS.map((c) => (
                <option key={c} value={c}>
                  {t(`admin-fleet.transmission.${c}`)}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t('admin-fleet.models.deposit')} htmlFor="m-dep" hint={t('admin-fleet.models.depositHint')}>
            <NumberInput id="m-dep" value={d.deposit} min={0} step={10000} suffix="₫" onChange={(v) => set({ deposit: v })} invalid={d.deposit === null} />
          </Field>
          <Field label={t('admin-fleet.models.license')} htmlFor="m-lic">
            <select id="m-lic" value={d.licenseRequired} onChange={(e) => set({ licenseRequired: e.target.value as Draft['licenseRequired'] })} className={inputClass}>
              {(['A1', 'A', 'NONE'] as const).map((c) => (
                <option key={c} value={c}>
                  {t(`admin-fleet.license.${c}`)}
                </option>
              ))}
            </select>
          </Field>
        </section>

        <section className="grid grid-cols-2 gap-4 sm:grid-cols-3" aria-label={t('admin-fleet.models.specs')}>
          <Field label={t('admin-fleet.models.engineCc')} htmlFor="m-cc">
            <NumberInput id="m-cc" value={d.engineCc} min={0} suffix="cc" onChange={(v) => set({ engineCc: v })} />
          </Field>
          <Field label={t('admin-fleet.models.year')} htmlFor="m-year">
            <NumberInput id="m-year" value={d.year} min={1950} max={2100} onChange={(v) => set({ year: v })} />
          </Field>
          <Field label={t('admin-fleet.models.seats')} htmlFor="m-seats">
            <NumberInput id="m-seats" value={d.seats} min={1} max={3} onChange={(v) => set({ seats: v ?? 2 })} />
          </Field>
          <Field label={t('admin-fleet.models.fuel')} htmlFor="m-fuel">
            <NumberInput id="m-fuel" value={d.fuelConsumption} min={0} step="any" suffix={t('admin-fleet.units.l100')} onChange={(v) => set({ fuelConsumption: v })} />
          </Field>
          <Field label={t('admin-fleet.models.tank')} htmlFor="m-tank">
            <NumberInput id="m-tank" value={d.tankLiters} min={0} step="any" suffix={t('admin-fleet.units.l')} onChange={(v) => set({ tankLiters: v })} />
          </Field>
          <Field label={t('admin-fleet.models.speed')} htmlFor="m-speed">
            <NumberInput id="m-speed" value={d.maxSpeedKmh} min={0} suffix={t('admin-fleet.units.kmh')} onChange={(v) => set({ maxSpeedKmh: v })} />
          </Field>
        </section>

        <div className="flex flex-col gap-1.5">
          <p className="text-caption font-bold">{t('admin-fleet.models.features')}</p>
          <ChipGroup label={t('admin-fleet.models.features')} className="flex flex-wrap gap-2">
            {MODEL_FEATURES.map((code) => (
              <Chip key={code} variant="option" selected={d.features.includes(code)} onClick={() => set({ features: d.features.includes(code) ? d.features.filter((x) => x !== code) : [...d.features, code] })}>
                {t(`admin-fleet.feature.${code}`)}
              </Chip>
            ))}
          </ChipGroup>
        </div>

        <I18nTextField label={t('admin-fleet.models.description')} value={d.description} onChange={(v) => set({ description: v })} multiline rows={4} maxLength={4000} />
        <I18nTextField label={t('admin-fleet.models.conditions')} value={d.conditions} onChange={(v) => set({ conditions: v })} multiline rows={3} maxLength={2000} hint={t('admin-fleet.models.conditionsHint')} />

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1.5 text-caption font-bold">{t('admin-fleet.models.included')}</legend>
          <div className="grid gap-3 sm:grid-cols-3">
            {LANG_ORDER.map((lang) => (
              <div key={lang} className="flex flex-col gap-1.5">
                <label htmlFor={`m-inc-${lang}`} className="text-label uppercase text-ink-muted">
                  {lang}
                </label>
                <textarea id={`m-inc-${lang}`} rows={4} value={d.included[lang]} onChange={(e) => set({ included: { ...d.included, [lang]: e.target.value } })} className={textareaClass} />
              </div>
            ))}
          </div>
          <span className="text-caption text-ink-muted">{t('admin-fleet.models.includedHint')}</span>
        </fieldset>

        <label className="flex items-center gap-3 text-body">
          <input type="checkbox" checked={d.isActive} onChange={(e) => set({ isActive: e.target.checked })} className="h-5 w-5 accent-[var(--accent)]" />
          {t('admin-fleet.models.showInCatalog')}
        </label>

        {model && (
          <p className="text-caption text-ink-muted">
            {t('admin-fleet.models.tariffsHint')}{' '}
            <Link to="/prices" className="text-accent-text underline underline-offset-4">
              {t('admin.nav.prices')}
            </Link>
          </p>
        )}
      </div>
    </Sheet>
  );
}
