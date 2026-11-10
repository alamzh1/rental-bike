import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MapPin, Plus, UserMinus } from 'lucide-react';
import type { AdminListOf, AdminLocation, AdminLocationInput, AdminLocationManager, I18nText } from '@rental/shared';
import { Badge, Button, EmptyState, IconButton, Sheet } from '@rental/ui';
import { api } from '@/app/providers';
import { Alert, Field, inputClass, PageHeader, Panel, useMe } from '@/app/ui';
import { DemoTag, I18nTextField, LoadGate, NumberInput, useAdminGet, useAdminSave } from '@/features/fleet/kit';
import { PayosPanel } from './PayosPanel';

type Draft = { name: Partial<I18nText>; address: string; lat: number | null; lng: number | null; openTime: string; closeTime: string; timezone: string; contact: string; legalName: string };

const draftOf = (l: AdminLocation): Draft => ({ name: l.name, address: l.address, lat: l.lat, lng: l.lng, openTime: l.openTime, closeTime: l.closeTime, timezone: l.timezone, contact: l.contact ?? '', legalName: l.legalName ?? '' });

/** Сотрудники точки одной роли: список, снять, назначить по Telegram ID. */
function StaffSection({ locationId, kind, people, onChanged }: { locationId: string; kind: 'managers' | 'owners'; people: AdminLocationManager[]; onChanged: (l: AdminLocation) => void }) {
  const { t } = useTranslation();
  const [tg, setTg] = useState('');
  const k = (name: string) => `admin-fleet.locations.${kind}.${name}`;
  const add = useAdminSave((telegramId: string) => api.post<AdminLocation>(`/admin/locations/${locationId}/${kind}`, { telegramId }).then((r) => (onChanged(r), r)), { success: t(k('added')), invalidate: ['/admin/locations'] });
  const remove = useAdminSave((userId: string) => api.del<AdminLocation>(`/admin/locations/${locationId}/${kind}/${userId}`).then((r) => (onChanged(r), r)), { success: t(k('removed')), invalidate: ['/admin/locations'] });
  const valid = /^\d{3,20}$/.test(tg.trim());
  return (
    <section aria-labelledby={`${locationId}-${kind}`} className="flex flex-col gap-3">
      <h3 id={`${locationId}-${kind}`} className="text-headline">
        {t(k('title'))}
      </h3>
      {people.length === 0 ? (
        <p className="text-body text-ink-muted">{t(k('none'))}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-line">
          {people.map((m) => (
            <li key={m.id} className="flex items-center justify-between gap-3 py-2">
              <span className="min-w-0">
                <span className="block text-body-strong">{m.name}</span>
                <span className="block text-caption text-ink-muted tabular">{m.username ? `@${m.username} · ` : ''}ID {m.telegramId}</span>
              </span>
              <IconButton icon={UserMinus} variant="surface" label={t(k('remove'), { name: m.name })} onClick={() => window.confirm(t('admin-fleet.locations.removeConfirm', { name: m.name })) && remove.mutate(m.id)} />
            </li>
          ))}
        </ul>
      )}
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (valid) add.mutate(tg.trim(), { onSuccess: () => setTg('') });
        }}
      >
        <div className="min-w-[160px] flex-1">
          <Field label={t(k('telegramId'))} htmlFor={`${locationId}-${kind}-tg`} hint={t(k('hint'))}>
            <input id={`${locationId}-${kind}-tg`} inputMode="numeric" value={tg} onChange={(e) => setTg(e.target.value)} className={`${inputClass} tabular`} />
          </Field>
        </div>
        <Button type="submit" variant="secondary" loading={add.isLoading} disabled={!valid}>
          {t('admin-fleet.locations.assign')}
        </Button>
      </form>
      {(add.error ?? remove.error) && <Alert>{add.error ?? remove.error}</Alert>}
    </section>
  );
}

function LocationCard({ location }: { location: AdminLocation }) {
  const { t } = useTranslation();
  const [d, setD] = useState<Draft>(() => draftOf(location));
  const me = useMe();
  const isAdmin = me.role === 'ADMIN';
  const set = (p: Partial<Draft>) => setD((x) => ({ ...x, ...p }));
  const save = useAdminSave((v: AdminLocationInput) => api.patch<AdminLocation>(`/admin/locations/${location.id}`, v), { success: t('admin-fleet.common.saved'), invalidate: ['/admin/locations'] });
  const dirty = JSON.stringify(d) !== JSON.stringify(draftOf(location));
  const valid = !!d.name.en?.trim() && !!d.address.trim() && d.lat !== null && d.lng !== null && d.openTime < d.closeTime;
  // Ответ последней операции; после обновления списка точек действует он
  const [latest, setLatest] = useState<AdminLocation | null>(null);
  const current = latest ?? location;
  const active = useAdminSave((isActive: boolean) => api.patch<AdminLocation>(`/admin/locations/${location.id}`, { isActive }).then((r) => (setLatest(r), r)), { success: t('admin-fleet.common.saved'), invalidate: ['/admin/locations', '/admin/models'] });
  const mapUrl = d.lat !== null && d.lng !== null ? `https://www.openstreetmap.org/?mlat=${d.lat}&mlon=${d.lng}#map=17/${d.lat}/${d.lng}` : null;

  return (
    <Panel
      title={location.name.en}
      actions={
        <span className="flex items-center gap-2">
          {!current.isActive && <Badge tone="neutral">{t('admin-fleet.locations.closed')}</Badge>}
          <DemoTag show={location.isDemo} />
          {isAdmin && (
            <Button size="sm" variant="ghost" loading={active.isLoading} onClick={() => (current.isActive ? window.confirm(t('admin-fleet.locations.closeConfirm')) : true) && active.mutate(!current.isActive)}>
              {t(current.isActive ? 'admin-fleet.locations.closePoint' : 'admin-fleet.locations.openPoint')}
            </Button>
          )}
        </span>
      }
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="flex flex-col gap-4">
          {save.error && <Alert>{save.error}</Alert>}
          <I18nTextField label={t('admin-fleet.locations.name')} value={d.name} onChange={(name) => set({ name })} maxLength={80} />
          <Field label={t('admin-fleet.locations.address')} htmlFor={`${location.id}-addr`}>
            <input id={`${location.id}-addr`} value={d.address} maxLength={300} onChange={(e) => set({ address: e.target.value })} className={inputClass} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t('admin-fleet.locations.lat')} htmlFor={`${location.id}-lat`}>
              <NumberInput id={`${location.id}-lat`} value={d.lat} min={-90} max={90} step="any" onChange={(lat) => set({ lat })} />
            </Field>
            <Field label={t('admin-fleet.locations.lng')} htmlFor={`${location.id}-lng`}>
              <NumberInput id={`${location.id}-lng`} value={d.lng} min={-180} max={180} step="any" onChange={(lng) => set({ lng })} />
            </Field>
          </div>
          {mapUrl && (
            <a href={mapUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 self-start text-body text-accent-text underline-offset-4 hover:underline">
              <MapPin size={16} aria-hidden /> {t('admin-fleet.locations.openMap')}
            </a>
          )}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Field label={t('admin-fleet.locations.open')} htmlFor={`${location.id}-open`}>
              <input id={`${location.id}-open`} type="time" step={900} value={d.openTime} onChange={(e) => set({ openTime: e.target.value })} className={`${inputClass} tabular`} />
            </Field>
            <Field label={t('admin-fleet.locations.close')} htmlFor={`${location.id}-close`}>
              <input id={`${location.id}-close`} type="time" step={900} value={d.closeTime} onChange={(e) => set({ closeTime: e.target.value })} className={`${inputClass} tabular`} />
            </Field>
            <Field label={t('admin-fleet.locations.timezone')} htmlFor={`${location.id}-tz`}>
              <input id={`${location.id}-tz`} value={d.timezone} maxLength={60} onChange={(e) => set({ timezone: e.target.value })} className={inputClass} />
            </Field>
          </div>
          <Field label={t('admin-fleet.locations.contact')} htmlFor={`${location.id}-contact`} hint={t('admin-fleet.locations.contactHint')}>
            <input id={`${location.id}-contact`} value={d.contact} maxLength={200} onChange={(e) => set({ contact: e.target.value })} className={inputClass} />
          </Field>
          <Field label={t('admin-fleet.locations.legalName')} htmlFor={`${location.id}-legal`} hint={t('admin-fleet.locations.legalNameHint')}>
            <input id={`${location.id}-legal`} value={d.legalName} maxLength={500} onChange={(e) => set({ legalName: e.target.value })} className={inputClass} />
          </Field>
          {d.openTime >= d.closeTime && <Alert tone="warning">{t('admin-fleet.locations.hoursInvalid')}</Alert>}
          <div className="flex justify-end">
            <Button variant={dirty ? 'primary' : 'secondary'} disabled={!dirty || !valid} loading={save.isLoading} onClick={() => save.mutate({ ...d, name: d.name as I18nText, lat: d.lat!, lng: d.lng!, contact: d.contact.trim() || null, legalName: d.legalName.trim() || null })}>
              {t('admin-fleet.common.save')}
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-6">
          {isAdmin && <StaffSection locationId={location.id} kind="owners" people={current.owners} onChanged={setLatest} />}
          <StaffSection locationId={location.id} kind="managers" people={current.managers} onChanged={setLatest} />
          <PayosPanel locationId={location.id} payos={current.payos} onChanged={setLatest} />
        </div>
      </div>
    </Panel>
  );
}

/** Новая точка арендодателя: дальше на ней назначается владелец и заводится парк. */
function NewLocationSheet({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const [name, setName] = useState<Partial<I18nText>>({});
  const [address, setAddress] = useState('');
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const create = useAdminSave((v: AdminLocationInput) => api.post<AdminLocation>('/admin/locations', v), { success: t('admin-fleet.locations.created'), invalidate: ['/admin/locations'] });
  const valid = !!name.en?.trim() && !!address.trim() && lat !== null && lng !== null;
  return (
    <Sheet
      open
      onClose={onClose}
      title={t('admin-fleet.locations.new')}
      closeLabel={t('admin.common.close')}
      footer={
        <Button block size="lg" disabled={!valid} loading={create.isLoading} onClick={() => create.mutate({ name: name as I18nText, address: address.trim(), lat: lat!, lng: lng! }, { onSuccess: onClose })}>
          {t('admin-fleet.locations.create')}
        </Button>
      }
    >
      <div className="flex flex-col gap-4 pb-2">
        {create.error && <Alert>{create.error}</Alert>}
        <I18nTextField label={t('admin-fleet.locations.name')} value={name} onChange={setName} maxLength={80} />
        <Field label={t('admin-fleet.locations.address')} htmlFor="new-addr">
          <input id="new-addr" value={address} maxLength={300} onChange={(e) => setAddress(e.target.value)} className={inputClass} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('admin-fleet.locations.lat')} htmlFor="new-lat">
            <NumberInput id="new-lat" value={lat} min={-90} max={90} step="any" onChange={setLat} />
          </Field>
          <Field label={t('admin-fleet.locations.lng')} htmlFor="new-lng">
            <NumberInput id="new-lng" value={lng} min={-180} max={180} step="any" onChange={setLng} />
          </Field>
        </div>
      </div>
    </Sheet>
  );
}

/** Точки выдачи: адрес, координаты, часы работы, владелец, менеджеры, счёт оплаты. Владелец видит только свою. */
export default function Locations() {
  const { t } = useTranslation();
  const me = useMe();
  const [creating, setCreating] = useState(false);
  const q = useAdminGet<AdminListOf<AdminLocation>>('/admin/locations');
  return (
    <>
      <PageHeader
        title={t('admin.nav.locations')}
        meta={t('admin-fleet.locations.meta')}
        actions={
          me.role === 'ADMIN' && (
            <Button size="sm" icon={Plus} onClick={() => setCreating(true)}>
              {t('admin-fleet.locations.new')}
            </Button>
          )
        }
      />
      <LoadGate isLoading={q.isLoading} isError={q.isError} onRetry={() => void q.refetch()}>
        {(q.data?.items.length ?? 0) === 0 ? (
          <EmptyState icon={MapPin} title={t('admin-fleet.locations.empty')} className="py-12" />
        ) : (
          <div className="flex flex-col gap-6">
            {q.data!.items.map((l) => (
              <LocationCard key={`${l.id}-${l.isDemo}-${l.openTime}-${l.closeTime}-${l.address}`} location={l} />
            ))}
          </div>
        )}
      </LoadGate>
      {creating && <NewLocationSheet onClose={() => setCreating(false)} />}
    </>
  );
}
