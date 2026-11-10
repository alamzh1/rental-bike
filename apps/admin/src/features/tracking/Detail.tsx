import { lazy, Suspense, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Check, Copy, MapPinOff, Plus, Satellite } from 'lucide-react';
import { canSeeMoney, type AdminTrackedBikeDetail, type AdminTrackerInput, type AdminTrackerSetup, type TrackedBooking } from '@rental/shared';
import { Badge, bookingStatusTone, Button, Chip, ChipGroup, cn, EmptyState, Icon, Skeleton } from '@rental/ui';
import type { AdminApiError } from '@/app/api';
import { api } from '@/app/providers';
import { Alert, Field, inputClass, PageHeader, Panel, useFormat, useMe, useToast } from '@/app/ui';
import { LoadGate, useAdminSave } from '@/features/fleet/kit';
import { Attention } from './index';
import { RentalLeft } from './RentalLeft';
import { mapsUrl, STATE_TONE } from './kit';

const BikeMap = lazy(() => import('./BikeMap'));
const REFRESH_MS = 30_000;
const HOURS = [24, 72, 168, 720] as const;

function BookingBlock({ title, booking, showLeft }: { title: string; booking: TrackedBooking; showLeft?: boolean }) {
  const f = useFormat();
  return (
    <Panel title={title}>
      <p className="text-headline">{booking.clientName}</p>
      {booking.phone && (
        <a href={`tel:${booking.phone}`} className="text-body text-accent-text tabular">
          {booking.phone}
        </a>
      )}
      <p className="mt-2 text-body tabular">
        {f.dateTime(booking.startAt)} — {f.dateTime(booking.endAt)}
      </p>
      {showLeft && (
        <p className="text-body">
          <RentalLeft endAt={booking.endAt} />
        </p>
      )}
      <Link to={`/bookings/${booking.id}`} className="mt-2 inline-block text-body-strong text-accent-text tabular underline-offset-4 hover:underline">
        {booking.code}
      </Link>
    </Panel>
  );
}

function CopyRow({ value, label }: { value: string; label: string }) {
  const { t } = useTranslation();
  const toast = useToast();
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast('danger', t('admin-ops.gps.copyFailed'));
    }
  };
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-caption font-bold">{label}</span>
      <div className="flex items-center gap-2">
        <code className="min-w-0 flex-1 break-all rounded-sm bg-surface px-3 py-2 text-caption">{value}</code>
        <Button size="sm" variant="secondary" icon={copied ? Check : Copy} onClick={() => void copy()}>
          {t(copied ? 'admin-ops.gps.copied' : 'admin-ops.gps.copy')}
        </Button>
      </div>
    </div>
  );
}

function TrackerPanel({ bikeId, tracker }: { bikeId: string; tracker: AdminTrackerSetup | null }) {
  const { t } = useTranslation();
  const client = useQueryClient();
  const [deviceId, setDeviceId] = useState(tracker?.deviceId ?? '');
  const [confirming, setConfirming] = useState(false);
  const refresh = async () => {
    await client.invalidateQueries({ queryKey: ['admin', '/admin/tracking'] });
    await client.invalidateQueries({ queryKey: ['tracking', bikeId] });
  };
  const connect = useAdminSave((body: AdminTrackerInput) => api.put<AdminTrackerSetup>(`/admin/tracking/${bikeId}/tracker`, body), { success: t('admin-ops.gps.saved') });
  const disconnect = useAdminSave(() => api.del<void>(`/admin/tracking/${bikeId}/tracker`), { success: t('admin-ops.gps.disconnected') });
  const submit = () => connect.mutate({ deviceId: deviceId.trim() || null }, { onSuccess: () => void refresh() });

  return (
    <Panel title={t('admin-ops.gps.setup')}>
      <div className="flex flex-col gap-4">
        {(connect.error ?? disconnect.error) && <Alert>{connect.error ?? disconnect.error}</Alert>}
        {tracker ? (
          <>
            <CopyRow value={tracker.ingestUrl} label={t('admin-ops.gps.url')} />
            <ol className="list-decimal pl-5 text-body">
              <li>{t('admin-ops.gps.step1')}</li>
              <li>{t('admin-ops.gps.step2')}</li>
              <li>{t('admin-ops.gps.step3')}</li>
            </ol>
            <p className="text-caption text-ink-muted">{t('admin-ops.gps.secret')}</p>
            <details>
              <summary className="cursor-pointer text-body-strong text-accent-text">{t('admin-ops.gps.hardware')}</summary>
              <div className="mt-3 flex flex-col gap-3">
                <p className="text-body">{tracker.forwardEnabled ? t('admin-ops.gps.hardwareText') : t('admin-ops.gps.hardwareOff')}</p>
                <Field label={t('admin-ops.gps.deviceId')} htmlFor="t-device" hint={t('admin-ops.gps.deviceIdHint')}>
                  <input id="t-device" value={deviceId} maxLength={64} onChange={(e) => setDeviceId(e.target.value)} className={`${inputClass} tabular`} />
                </Field>
                <Button size="sm" variant="secondary" className="self-start" loading={connect.isLoading} onClick={submit}>
                  {t('admin-fleet.common.save')}
                </Button>
              </div>
            </details>
            {confirming ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-body">{t('admin-ops.gps.disconnectConfirm')}</span>
                <Button size="sm" variant="secondary" className="text-danger" loading={disconnect.isLoading} onClick={() => disconnect.mutate(undefined, { onSuccess: () => void refresh() })}>
                  {t('admin-ops.gps.disconnect')}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>
                  {t('admin.common.cancel')}
                </Button>
              </div>
            ) : (
              <Button size="sm" variant="ghost" className="self-start text-danger" onClick={() => setConfirming(true)}>
                {t('admin-ops.gps.disconnect')}
              </Button>
            )}
          </>
        ) : (
          <>
            <p className="text-body text-ink-muted">{t('admin-ops.gps.intro')}</p>
            <Button icon={Satellite} className="self-start" loading={connect.isLoading} onClick={submit}>
              {t('admin-ops.gps.connect')}
            </Button>
          </>
        )}
      </div>
    </Panel>
  );
}

/** Карточка байка: у кого он, где он, трек, подключение GPS, деньги за всё время и история броней. */
export default function BikeDetail() {
  const { id = '' } = useParams();
  const { t } = useTranslation();
  const f = useFormat();
  const me = useMe();
  const [hours, setHours] = useState<(typeof HOURS)[number]>(24);
  const q = useQuery<AdminTrackedBikeDetail, AdminApiError>({ queryKey: ['tracking', id, hours], queryFn: () => api.get<AdminTrackedBikeDetail>(`/admin/tracking/${id}`, { hours }), refetchInterval: REFRESH_MS, keepPreviousData: true });
  const d = q.data;
  const b = d?.bike;
  const gps = b?.gps;
  const hasFix = gps && gps.lat !== null && gps.lng !== null;
  const center: [number, number] = hasFix ? [gps.lat!, gps.lng!] : (d?.track[0] ? [d.track[0].lat, d.track[0].lng] : [13.7765, 109.2237]);

  return (
    <>
      <Link to="/tracking" className="hit-44 mb-3 inline-flex items-center gap-1 text-body text-accent-text">
        <Icon icon={ArrowLeft} size={16} />
        {t('admin.nav.tracking')}
      </Link>
      <LoadGate isLoading={q.isLoading} isError={q.isError} onRetry={() => void q.refetch()}>
        {d && b && gps && (
          <>
            <PageHeader
              title={b.plate}
              meta={`${b.modelName} · ${t('admin-fleet.bikes.km', { km: b.mileageKm.toLocaleString(f.lang) })}`}
              actions={
                <>
                  <Badge tone={STATE_TONE[b.state]}>{t(`admin-ops.state.${b.state}`)}</Badge>
                  {canSeeMoney(me.role) && (
                    <Link to={`/finance?addExpense=${b.id}`} className="inline-flex h-control-md items-center gap-2 rounded-md bg-surface px-5 text-button text-ink">
                      <Icon icon={Plus} size={16} />
                      {t('admin-ops.expense.add')}
                    </Link>
                  )}
                </>
              }
            />
            <Attention items={b.attention} />
            <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
              <div className="flex min-w-0 flex-col gap-6">
                <Panel
                  title={t('admin-ops.gps.position')}
                  actions={
                    gps.connected ? <span className={cn('text-caption font-bold', gps.online ? 'text-success' : 'text-warning')}>{t(gps.online ? 'admin-ops.gps.online' : 'admin-ops.gps.offline')}</span> : undefined
                  }
                >
                  {hasFix || d.track.length ? (
                    <div className="flex flex-col gap-3">
                      <Suspense fallback={<Skeleton className="h-[360px]" />}>
                        <BikeMap bikes={hasFix ? [{ id: b.id, plate: b.plate, lat: gps.lat!, lng: gps.lng!, state: b.state, online: gps.online }] : []} track={d.track} center={center} height={360} />
                      </Suspense>
                      <ChipGroup label={t('admin-ops.gps.trackPeriod')} scroll className="flex gap-2">
                        {HOURS.map((h) => (
                          <Chip key={h} selected={hours === h} onClick={() => setHours(h)}>
                            {t(`admin-ops.gps.hours.${h}`)}
                          </Chip>
                        ))}
                      </ChipGroup>
                      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                        <div>
                          <dt className="text-caption text-ink-muted">{t('admin-ops.gps.lastSeen')}</dt>
                          <dd className="text-body tabular">{gps.lastSeenAt ? f.dateTime(gps.lastSeenAt) : '—'}</dd>
                        </div>
                        <div>
                          <dt className="text-caption text-ink-muted">{t('admin-ops.gps.speed')}</dt>
                          <dd className="text-body tabular">{gps.speedKmh !== null ? t('admin-ops.gps.kmh', { value: Math.round(gps.speedKmh) }) : '—'}</dd>
                        </div>
                        <div>
                          <dt className="text-caption text-ink-muted">{t('admin-ops.gps.battery')}</dt>
                          <dd className="text-body tabular">{gps.batteryPct !== null ? `${gps.batteryPct} %` : '—'}</dd>
                        </div>
                        {hasFix && (
                          <div>
                            <dt className="text-caption text-ink-muted">{t('admin-ops.gps.coords')}</dt>
                            <dd className="text-body">
                              <a href={mapsUrl(gps.lat!, gps.lng!)} target="_blank" rel="noopener noreferrer" className="text-accent-text">
                                {t('admin-ops.gps.openMaps')}
                              </a>
                            </dd>
                          </div>
                        )}
                      </dl>
                    </div>
                  ) : (
                    <EmptyState icon={MapPinOff} title={t(gps.connected ? 'admin-ops.gps.waiting' : 'admin-ops.gps.notConnected')} text={t(gps.connected ? 'admin-ops.gps.waitingText' : 'admin-ops.gps.notConnectedText')} className="py-8" />
                  )}
                </Panel>

                <Panel title={t('admin-ops.tracking.history')} bodyClassName={d.history.length ? 'p-0' : undefined}>
                  {d.history.length === 0 ? (
                    <p className="text-body text-ink-muted">{t('admin-ops.tracking.noHistory')}</p>
                  ) : (
                    <ul>
                      {d.history.map((r) => (
                        <li key={r.id} className="border-b border-line last:border-0">
                          <Link to={`/bookings/${r.id}`} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3 hover:bg-surface">
                            <span className="min-w-0">
                              <span className="text-body-strong tabular">{r.code}</span> <span className="text-body text-ink-muted">· {r.client.name}</span>
                              <span className="block text-caption text-ink-muted tabular">
                                {f.dateTime(r.startAt)} — {f.dateTime(r.endAt)}
                              </span>
                            </span>
                            <Badge tone={bookingStatusTone(r.status)}>{t(`admin.status.${r.status}`)}</Badge>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </Panel>
              </div>

              <div className="flex min-w-0 flex-col gap-6">
                {b.current && <BookingBlock title={t('admin-ops.tracking.current')} booking={b.current} showLeft />}
                {b.next && <BookingBlock title={t('admin-ops.tracking.next')} booking={b.next} />}
                {d.finance && (
                  <Panel title={t('admin-ops.tracking.finance')}>
                    <dl className="flex flex-col">
                      {[
                        [t('admin-ops.finance.income'), f.money(d.finance.income)],
                        [t('admin-ops.finance.expenses'), f.money(d.finance.expenses)],
                        [t('admin-ops.finance.profit'), f.money(d.finance.profit)],
                        [t('admin-ops.finance.purchase'), d.finance.purchasePrice !== null ? f.money(d.finance.purchasePrice) : '—'],
                        [t('admin-ops.finance.payback'), d.finance.paybackPercent !== null ? `${d.finance.paybackPercent} %` : '—'],
                      ].map(([k, v]) => (
                        <div key={k} className="flex justify-between gap-3 border-b border-line py-2 text-body last:border-0">
                          <dt className="text-ink-muted">{k}</dt>
                          <dd className="tabular">{v}</dd>
                        </div>
                      ))}
                    </dl>
                    {d.finance.purchasePrice === null && <p className="mt-2 text-caption text-ink-muted">{t('admin-ops.tracking.purchaseHint')}</p>}
                  </Panel>
                )}
                {canSeeMoney(me.role) && <TrackerPanel key={d.tracker?.ingestUrl ?? 'off'} bikeId={b.id} tracker={d.tracker} />}
              </div>
            </div>
          </>
        )}
      </LoadGate>
    </>
  );
}
