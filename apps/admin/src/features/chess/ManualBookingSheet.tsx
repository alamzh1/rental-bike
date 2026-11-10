import { useEffect, useMemo, useState } from 'react';
import { useCreate } from '@refinedev/core';
import { useTranslation } from 'react-i18next';
import type { AdminBookingDetail, AdminManualBookingRequest, ChessBike, Lang } from '@rental/shared';
import { Button, Chip, ChipGroup, Sheet } from '@rental/ui';
import { Alert, Field, inputClass, useErrorText, useFormat, useToast } from '@/app/ui';
import { localInputToIso } from './layout';

export interface ManualDraft {
  modelId: string;
  bikeId: string;
  start: string;
  end: string;
}

const E164 = /^\+[1-9]\d{6,14}$/;

/** Ручная бронь для клиента «с улицы»: POST /admin/bookings — те же проверки доступности и правил, что в Mini App. */
export function ManualBookingSheet({ open, draft, bikes, onClose, onCreated }: { open: boolean; draft: ManualDraft; bikes: ChessBike[]; onClose: () => void; onCreated: (b: AdminBookingDetail) => void }) {
  const { t } = useTranslation();
  const f = useFormat();
  const toast = useToast();
  const errorText = useErrorText();
  const { mutate: create, isLoading } = useCreate<AdminBookingDetail>();
  const [form, setForm] = useState(draft);
  const [phone, setPhone] = useState('+84');
  const [name, setName] = useState('');
  const [lang, setLang] = useState<Lang>('en');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setForm(draft);
      setError(null);
    }
  }, [open, draft]);

  const models = useMemo(() => [...new Map(bikes.filter((b) => b.status !== 'RETIRED').map((b) => [b.modelId, b.modelName])).entries()], [bikes]);
  const modelBikes = bikes.filter((b) => b.modelId === form.modelId && b.status !== 'RETIRED');
  const startIso = localInputToIso(form.start, f.tz);
  const endIso = localInputToIso(form.end, f.tz);
  const datesOk = !!startIso && !!endIso && endIso > startIso;
  const phoneOk = E164.test(phone.trim());

  const submit = () => {
    if (!datesOk) return setError(t('admin.manual.invalidDates'));
    setError(null);
    const values: AdminManualBookingRequest = { modelId: form.modelId, startAt: startIso!, endAt: endIso!, paymentMethod: 'CASH', phone: phone.trim(), name: name.trim() || undefined, lang, ...(form.bikeId ? { bikeId: form.bikeId } : {}) };
    create(
      { resource: 'bookings', values, successNotification: false, errorNotification: false },
      {
        onSuccess: (r) => {
          toast('success', t('admin.manual.created', { code: r.data.code }));
          onCreated(r.data);
        },
        onError: (e) => setError(errorText(e)),
      },
    );
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t('admin.manual.title')}
      closeLabel={t('admin.common.close')}
      footer={
        <Button block size="lg" loading={isLoading} disabled={!form.modelId || !phoneOk || !datesOk} onClick={submit}>
          {t('admin.manual.submit')}
        </Button>
      }
    >
      <div className="flex flex-col gap-4 pb-2">
        <p className="text-body text-ink-muted">{t('admin.manual.text')}</p>
        {error && <Alert>{error}</Alert>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('admin.manual.model')} htmlFor="m-model">
            <select id="m-model" value={form.modelId} onChange={(e) => setForm({ ...form, modelId: e.target.value, bikeId: '' })} className={inputClass}>
              <option value="" disabled>
                {t('admin.common.none')}
              </option>
              {models.map(([id, n]) => (
                <option key={id} value={id}>
                  {n}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t('admin.manual.bike')} htmlFor="m-bike">
            <select id="m-bike" value={form.bikeId} onChange={(e) => setForm({ ...form, bikeId: e.target.value })} className={inputClass} disabled={!form.modelId}>
              <option value="">{t('admin.manual.anyBike')}</option>
              {modelBikes.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.plate}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t('admin.manual.start')} htmlFor="m-start" hint={t('admin.manual.timeHint', { tz: f.tz })}>
            <input id="m-start" type="datetime-local" step={900} value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} className={`${inputClass} tabular`} />
          </Field>
          <Field label={t('admin.manual.end')} htmlFor="m-end">
            <input id="m-end" type="datetime-local" step={900} value={form.end} min={form.start || undefined} onChange={(e) => setForm({ ...form, end: e.target.value })} className={`${inputClass} tabular`} />
          </Field>
          <Field label={t('admin.manual.phone')} htmlFor="m-phone" hint={t('admin.manual.phoneHint')}>
            <input id="m-phone" type="tel" inputMode="tel" autoComplete="off" value={phone} onChange={(e) => setPhone(e.target.value)} className={`${inputClass} tabular`} aria-invalid={phone.length > 3 && !phoneOk} />
          </Field>
          <Field label={t('admin.manual.name')} htmlFor="m-name">
            <input id="m-name" value={name} maxLength={100} onChange={(e) => setName(e.target.value)} className={inputClass} />
          </Field>
        </div>
        <div className="flex flex-col gap-1.5">
          <p className="text-caption font-bold">{t('admin.manual.lang')}</p>
          <ChipGroup label={t('admin.manual.lang')} className="flex flex-wrap gap-2">
          {(['ru', 'en', 'vi'] as const).map((l) => (
            <Chip key={l} selected={lang === l} onClick={() => setLang(l)}>
              {t(`common.languages.${l}`)}
            </Chip>
          ))}
          </ChipGroup>
        </div>
      </div>
    </Sheet>
  );
}
