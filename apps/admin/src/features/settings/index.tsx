import { useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import type { AdminSettingKey, AdminSettings, AdminSettingsPatch, AdminSettingsResponse, Currency, Lang, RubTransferSettings } from '@rental/shared';
import { Button, Chip, ChipGroup } from '@rental/ui';
import { api } from '@/app/providers';
import { Alert, Field, inputClass, PageHeader, Panel, useFormat } from '@/app/ui';
import { DemoTag, LANG_ORDER, LoadGate, NumberInput, useAdminGet, useAdminSave } from '@/features/fleet/kit';
import { changedKeys, fromVndPer, toVndPer } from './form';

type Form = Omit<AdminSettings, 'rates' | 'ratesManual' | 'contractTemplate' | 'rulesText' | 'restrictionsText' | 'privacyText' | 'faq'> & {
  /** Курс в форме — сколько ₫ за 1 ₽ / $ (так его видит владелец) */
  vndPerRub: number | null;
  vndPerUsd: number | null;
};

const formOf = (v: AdminSettings): Form => {
  const { rates, ratesManual: _m, contractTemplate: _c, rulesText: _r, restrictionsText: _x, privacyText: _p, faq: _f, ...rest } = v;
  return { ...rest, vndPerRub: toVndPer(rates.RUB), vndPerUsd: toVndPer(rates.USD) };
};

function patchOf(form: Form, base: Form): AdminSettingsPatch {
  const { vndPerRub, vndPerUsd, ...rest } = form;
  const patch: AdminSettingsPatch = {};
  for (const k of changedKeys(rest, (({ vndPerRub: _a, vndPerUsd: _b, ...r }) => r)(base))) (patch as Record<string, unknown>)[k] = rest[k as keyof typeof rest];
  if (vndPerRub !== base.vndPerRub || vndPerUsd !== base.vndPerUsd) patch.rates = { RUB: fromVndPer(vndPerRub), USD: fromVndPer(vndPerUsd) };
  return patch;
}

function Section({ title, children, demo, hint }: { title: string; children: ReactNode; demo?: boolean; hint?: string }) {
  return (
    <Panel title={title} actions={<DemoTag show={!!demo} />}>
      {hint && <p className="mb-4 max-w-[70ch] text-body text-ink-muted">{hint}</p>}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
    </Panel>
  );
}

function SettingsForm({ data }: { data: AdminSettingsResponse }) {
  const { t } = useTranslation();
  const f = useFormat();
  const base = useMemo(() => formOf(data.values), [data.values]);
  const [form, setForm] = useState<Form>(base);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((x) => ({ ...x, [k]: v }));
  // Все поля пусты — способ выключен; часть заполнена — сохранять нельзя, клиент увидел бы неполные реквизиты
  const setRub = (patch: Partial<RubTransferSettings>) => {
    const next = { phone: '', bank: '', recipient: '', markupPercent: 0, ...form.rubTransfer, ...patch };
    set('rubTransfer', next.phone || next.bank || next.recipient ? next : null);
  };
  const rubPartial = !!form.rubTransfer && (!form.rubTransfer.phone.trim() || !form.rubTransfer.bank.trim() || !form.rubTransfer.recipient.trim());
  const demo = (...keys: AdminSettingKey[]) => keys.some((k) => data.demo.includes(k));
  const patch = patchOf(form, base);
  const dirty = Object.keys(patch).length > 0;
  const save = useAdminSave((p: AdminSettingsPatch) => api.patch<AdminSettingsResponse>('/admin/settings', p), { success: t('admin-fleet.settings.saved'), invalidate: ['/admin/settings'] });
  const invalid =
    form.cancel.halfHours > form.cancel.fullHours ||
    [form.holdMinutes, form.bufferMinutes, form.minLeadMinutes, form.minRentDays, form.noShowHours, form.docRetentionDays, form.cashPrepayPercent].some((n) => n === null || Number.isNaN(n)) ||
    rubPartial ||
    !form.vndPerRub ||
    !form.vndPerUsd;
  const num = (k: 'holdMinutes' | 'bufferMinutes' | 'minLeadMinutes' | 'minRentDays' | 'noShowHours' | 'docRetentionDays' | 'cashPrepayPercent', suffix: string, min = 0, max?: number) => (
    <Field label={t(`admin-fleet.settings.${k}`)} htmlFor={`s-${k}`} hint={t(`admin-fleet.settings.hint.${k}`)}>
      <NumberInput id={`s-${k}`} value={form[k]} min={min} max={max} suffix={suffix} onChange={(v) => set(k, v as number)} />
    </Field>
  );
  const min = t('admin-fleet.units.min');
  const h = t('admin-fleet.units.h');
  const days = t('admin-fleet.units.days');

  return (
    <form
      className="flex flex-col gap-6 pb-24"
      onSubmit={(e) => {
        e.preventDefault();
        if (dirty && !invalid) save.mutate(patch);
      }}
    >
      <Section title={t('admin-fleet.settings.bookings')}>
        {num('holdMinutes', min, 5, 1440)}
        {num('bufferMinutes', min, 0, 1440)}
        {num('minLeadMinutes', min, 0)}
        {num('minRentDays', days, 1, 60)}
        {num('noShowHours', h, 1, 72)}
      </Section>

      <Section title={t('admin-fleet.settings.cancel')} demo={demo('cancel')} hint={t('admin-fleet.settings.cancelHint', { full: form.cancel.fullHours, half: form.cancel.halfHours, percent: form.cancel.halfPercent })}>
        <Field label={t('admin-fleet.settings.fullHours')} htmlFor="s-full">
          <NumberInput id="s-full" value={form.cancel.fullHours} min={0} suffix={h} onChange={(v) => set('cancel', { ...form.cancel, fullHours: v ?? 0 })} />
        </Field>
        <Field label={t('admin-fleet.settings.halfHours')} htmlFor="s-half">
          <NumberInput id="s-half" value={form.cancel.halfHours} min={0} suffix={h} onChange={(v) => set('cancel', { ...form.cancel, halfHours: v ?? 0 })} invalid={form.cancel.halfHours > form.cancel.fullHours} />
        </Field>
        <Field label={t('admin-fleet.settings.halfPercent')} htmlFor="s-pct">
          <NumberInput id="s-pct" value={form.cancel.halfPercent} min={0} max={100} suffix="%" onChange={(v) => set('cancel', { ...form.cancel, halfPercent: v ?? 0 })} />
        </Field>
      </Section>

      <Section title={t('admin-fleet.settings.late')} demo={demo('late')} hint={t('admin-fleet.settings.lateHint')}>
        <Field label={t('admin-fleet.settings.graceMinutes')} htmlFor="s-grace">
          <NumberInput id="s-grace" value={form.late.graceMinutes} min={0} suffix={min} onChange={(v) => set('late', { ...form.late, graceMinutes: v ?? 0 })} />
        </Field>
        <Field label={t('admin-fleet.settings.hourlyFee')} htmlFor="s-fee">
          <NumberInput id="s-fee" value={form.late.hourlyFee} min={0} step={5000} suffix="₫" onChange={(v) => set('late', { ...form.late, hourlyFee: v ?? 0 })} />
        </Field>
        <Field label={t('admin-fleet.settings.extraDayAfterHours')} htmlFor="s-xday">
          <NumberInput id="s-xday" value={form.late.extraDayAfterHours} min={1} max={24} suffix={h} onChange={(v) => set('late', { ...form.late, extraDayAfterHours: v ?? 1 })} />
        </Field>
      </Section>

      <Section title={t('admin-fleet.settings.deposit')} demo={demo('depositMode', 'cashPrepayPercent')}>
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <p className="text-caption font-bold">{t('admin-fleet.settings.depositMode')}</p>
          <ChipGroup label={t('admin-fleet.settings.depositMode')} className="flex flex-wrap gap-2">
            {(['MONEY', 'DOCUMENT'] as const).map((m) => (
              <Chip key={m} variant="option" selected={form.depositMode === m} onClick={() => set('depositMode', m)}>
                {t(`admin-fleet.settings.depositModeName.${m}`)}
              </Chip>
            ))}
          </ChipGroup>
          <span className="text-caption text-ink-muted">{t(`admin-fleet.settings.depositModeHint.${form.depositMode}`)}</span>
        </div>
        {num('cashPrepayPercent', '%', 0, 100)}
      </Section>

      <Section title={t('admin-fleet.settings.rub.title')} demo={demo('rubTransfer')} hint={t('admin-fleet.settings.rub.hint')}>
        {(['phone', 'bank', 'recipient'] as const).map((k) => (
          <Field key={k} label={t(`admin-fleet.settings.rub.${k}`)} htmlFor={`s-rub-${k}`}>
            <input id={`s-rub-${k}`} className={inputClass} maxLength={100} value={form.rubTransfer?.[k] ?? ''} onChange={(e) => setRub({ [k]: e.target.value })} />
          </Field>
        ))}
        <Field label={t('admin-fleet.settings.rub.markup')} htmlFor="s-rub-markup" hint={t('admin-fleet.settings.rub.markupHint')}>
          <NumberInput id="s-rub-markup" value={form.rubTransfer?.markupPercent ?? 0} min={0} max={20} step="any" suffix="%" onChange={(v) => setRub({ markupPercent: v ?? 0 })} />
        </Field>
      </Section>

      <Section title={t('admin-fleet.settings.money')} demo={demo('rates', 'defaultCurrencyByLang')} hint={t('admin-fleet.settings.ratesHint')}>
        {data.values.ratesManual && (
          <div className="flex flex-wrap items-center gap-3 sm:col-span-2 lg:col-span-3">
            <span className="text-caption text-ink-muted">{t('admin-fleet.settings.ratesManual')}</span>
            <Button type="button" size="sm" variant="secondary" loading={save.isLoading} onClick={() => save.mutate({ rates: { RUB: data.values.rates.RUB, USD: data.values.rates.USD, auto: true } })}>
              {t('admin-fleet.settings.ratesAuto')}
            </Button>
          </div>
        )}
        <Field label={t('admin-fleet.settings.vndPerRub')} htmlFor="s-rub" hint={form.vndPerRub ? t('admin-fleet.settings.rateExample', { vnd: f.money(150_000), value: (150_000 / form.vndPerRub).toFixed(0), cur: '₽' }) : undefined}>
          <NumberInput id="s-rub" value={form.vndPerRub} min={1} step="any" suffix="₫" onChange={(v) => set('vndPerRub', v)} invalid={!form.vndPerRub} />
        </Field>
        <Field label={t('admin-fleet.settings.vndPerUsd')} htmlFor="s-usd" hint={form.vndPerUsd ? t('admin-fleet.settings.rateExample', { vnd: f.money(150_000), value: (150_000 / form.vndPerUsd).toFixed(2), cur: '$' }) : undefined}>
          <NumberInput id="s-usd" value={form.vndPerUsd} min={1} step="any" suffix="₫" onChange={(v) => set('vndPerUsd', v)} invalid={!form.vndPerUsd} />
        </Field>
        <div className="flex flex-col gap-2 sm:col-span-2 lg:col-span-3">
          <p className="text-caption font-bold">{t('admin-fleet.settings.defaultCurrency')}</p>
          <div className="grid gap-3 sm:grid-cols-3">
            {LANG_ORDER.map((l: Lang) => (
              <Field key={l} label={t(`common.languages.${l}`)} htmlFor={`s-cur-${l}`}>
                <select id={`s-cur-${l}`} value={form.defaultCurrencyByLang[l]} onChange={(e) => set('defaultCurrencyByLang', { ...form.defaultCurrencyByLang, [l]: e.target.value as Currency })} className={inputClass}>
                  {(['VND', 'RUB', 'USD'] as const).map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </Field>
            ))}
          </div>
        </div>
      </Section>

      <Section title={t('admin-fleet.settings.service')} demo={demo('managerContact', 'docRetentionDays')}>
        <Field label={t('admin-fleet.settings.managerContact')} htmlFor="s-contact" hint={t('admin-fleet.settings.hint.managerContact')}>
          <input id="s-contact" value={form.managerContact ?? ''} maxLength={200} placeholder="@username" onChange={(e) => set('managerContact', e.target.value.trim() ? e.target.value : null)} className={inputClass} />
        </Field>
        {num('docRetentionDays', days, 1, 3650)}
        <p className="text-caption text-ink-muted sm:col-span-2 lg:col-span-3">
          {t('admin-fleet.settings.moreHint')}{' '}
          <Link to="/prices" className="text-accent-text underline underline-offset-4">
            {t('admin.nav.prices')}
          </Link>
          {' · '}
          <Link to="/texts" className="text-accent-text underline underline-offset-4">
            {t('admin.nav.texts')}
          </Link>
        </p>
      </Section>

      {save.error && <Alert>{save.error}</Alert>}
      <div className="sticky bottom-[calc(env(safe-area-inset-bottom)+theme(spacing.24))] z-nav flex flex-wrap lg:bottom-4 items-center justify-end gap-3 rounded-xl bg-nav p-2 pl-4 shadow-nav">
        <span className="mr-auto text-caption text-on-nav" aria-live="polite">
          {dirty ? t('admin-fleet.settings.unsaved', { count: Object.keys(patch).length }) : t('admin-fleet.settings.allSaved')}
        </span>
        {dirty && (
          <Button type="button" variant="ghost" className="text-on-nav" onClick={() => setForm(base)}>
            {t('admin.common.reset')}
          </Button>
        )}
        <Button type="submit" disabled={!dirty || invalid} loading={save.isLoading}>
          {t('admin-fleet.settings.save')}
        </Button>
      </div>
    </form>
  );
}

/** Настройки правил: удержание, буфер, минимумы, неявка, отмена, опоздание, депозит, предоплата, курсы, контакт, хранение документов. */
export default function Settings() {
  const { t } = useTranslation();
  const q = useAdminGet<AdminSettingsResponse>('/admin/settings');
  return (
    <>
      <PageHeader title={t('admin.nav.settings')} meta={t('admin-fleet.settings.meta')} />
      <LoadGate isLoading={q.isLoading} isError={q.isError} onRetry={() => void q.refetch()} rows={6}>
        {q.data && <SettingsForm key={JSON.stringify(q.data.values)} data={q.data} />}
      </LoadGate>
    </>
  );
}
