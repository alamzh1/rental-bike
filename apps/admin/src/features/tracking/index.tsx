import { lazy, Suspense, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { Bike, CircleAlert, MapPinOff, Satellite, Search } from 'lucide-react';
import { type AdminTrackedBike, type AdminTrackingList, type BikeAttention } from '@rental/shared';
import { Badge, Chip, ChipGroup, cn, EmptyState, Icon, Skeleton } from '@rental/ui';
import type { AdminApiError } from '@/app/api';
import { api } from '@/app/providers';
import { CallLink, DataTable, inputClass, PageHeader, Panel, td, th, useFormat } from '@/app/ui';
import { LoadGate } from '@/features/fleet/kit';
import { STATE_TONE } from './kit';
import { RentalLeft } from './RentalLeft';

const BikeMap = lazy(() => import('./BikeMap'));
const REFRESH_MS = 30_000;
const FALLBACK: [number, number] = [13.7765, 109.2237];
const FILTERS = ['all', 'attention', 'rented', 'free', 'service', 'gps'] as const;
type Filter = (typeof FILTERS)[number];
const SEVERE: ReadonlySet<BikeAttention> = new Set(['OVERDUE', 'MOVING_UNRENTED', 'INSURANCE_EXPIRED']);

function matches(b: AdminTrackedBike, f: Filter): boolean {
  switch (f) {
    case 'attention':
      return b.attention.length > 0;
    case 'rented':
      return b.state === 'RENTED' || b.state === 'OVERDUE' || b.state === 'PROBLEM';
    case 'free':
      return b.state === 'FREE' || b.state === 'RESERVED';
    case 'service':
      return b.state === 'REPAIR' || b.attention.includes('SERVICE_DUE');
    case 'gps':
      return b.gps.connected;
    default:
      return b.state !== 'RETIRED';
  }
}

export function Attention({ items }: { items: BikeAttention[] }) {
  const { t } = useTranslation();
  if (!items.length) return null;
  return (
    <ul className="mt-1 flex flex-col gap-0.5">
      {items.map((a) => (
        <li key={a} className={cn('flex items-center gap-1 text-caption font-bold', SEVERE.has(a) ? 'text-danger' : 'text-warning')}>
          <Icon icon={CircleAlert} size={16} />
          {t(`admin-ops.attention.${a}`)}
        </li>
      ))}
    </ul>
  );
}

function GpsCell({ bike }: { bike: AdminTrackedBike }) {
  const { t } = useTranslation();
  const f = useFormat();
  if (!bike.gps.connected) return <span className="text-caption text-ink-muted">{t('admin-ops.gps.none')}</span>;
  return (
    <span className="text-caption">
      <span className={cn('font-bold', bike.gps.online ? 'text-success' : 'text-warning')}>{t(bike.gps.online ? 'admin-ops.gps.online' : 'admin-ops.gps.offline')}</span>
      {bike.gps.lastSeenAt && <span className="block text-ink-muted tabular">{f.dateTime(bike.gps.lastSeenAt)}</span>}
    </span>
  );
}

/** Мониторинг: где каждый байк, у кого он, когда вернётся и что требует внимания. Обновляется раз в 30 с. */
export default function Tracking() {
  const { t } = useTranslation();
  const f = useFormat();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<Filter>('all');
  const [q, setQ] = useState('');
  const list = useQuery<AdminTrackingList, AdminApiError>({ queryKey: ['admin', '/admin/tracking'], queryFn: () => api.get<AdminTrackingList>('/admin/tracking'), refetchInterval: REFRESH_MS });
  const items = useMemo(() => list.data?.items ?? [], [list.data]);
  const needle = q.trim().toLowerCase();
  const rows = items
    .filter((b) => matches(b, filter))
    .filter((b) => !needle || [b.plate, b.modelName, b.current?.clientName, b.current?.code, b.current?.phone].some((v) => v?.toLowerCase().includes(needle)));
  const onMap = items.filter((b) => b.gps.lat !== null && b.gps.lng !== null && b.state !== 'RETIRED');
  const mapBikes = onMap.map((b) => ({ id: b.id, plate: b.plate, lat: b.gps.lat!, lng: b.gps.lng!, state: b.state, online: b.gps.online }));
  const center: [number, number] = list.data?.location ? [list.data.location.lat, list.data.location.lng] : FALLBACK;
  const rented = items.filter((b) => matches(b, 'rented')).length;
  const free = items.filter((b) => matches(b, 'free')).length;
  const attention = items.filter((b) => b.attention.length).length;

  return (
    <>
      <PageHeader title={t('admin.nav.tracking')} meta={t('admin-ops.tracking.meta', { rented, free, attention })} />
      <LoadGate isLoading={list.isLoading} isError={list.isError} onRetry={() => void list.refetch()}>
        {items.length === 0 ? (
          <EmptyState icon={Bike} title={t('admin-fleet.bikes.empty')} text={t('admin-fleet.bikes.emptyText')} className="py-12" />
        ) : (
          <div className="flex flex-col gap-5">
            <Panel title={t('admin-ops.tracking.map')} actions={<span className="text-caption text-ink-muted">{t('admin-ops.tracking.onMap', { count: onMap.length, total: items.length })}</span>}>
              {mapBikes.length ? (
                <Suspense fallback={<Skeleton className="h-[360px]" />}>
                  <BikeMap bikes={mapBikes} center={center} height={360} onSelect={(id) => navigate(`/tracking/${id}`)} />
                </Suspense>
              ) : (
                <EmptyState icon={MapPinOff} title={t('admin-ops.tracking.noPositions')} text={t('admin-ops.tracking.noPositionsText')} className="py-8" />
              )}
            </Panel>
            <div className="flex flex-wrap items-center gap-3">
              <ChipGroup label={t('admin-ops.tracking.filter')} scroll className="flex gap-2">
                {FILTERS.map((k) => (
                  <Chip key={k} selected={filter === k} onClick={() => setFilter(k)}>
                    {t(`admin-ops.tracking.filters.${k}`)} <span className="tabular">{items.filter((b) => matches(b, k)).length}</span>
                  </Chip>
                ))}
              </ChipGroup>
              <div className="relative min-w-[220px] flex-1">
                <Icon icon={Search} size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
                <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('admin-ops.tracking.search')} aria-label={t('admin-ops.tracking.search')} className={`${inputClass} pl-9`} />
              </div>
            </div>
            {rows.length === 0 ? (
              <EmptyState icon={Satellite} title={t('admin-ops.tracking.nothing')} className="py-8" />
            ) : (
              <>
                <div className="hidden rounded-lg border border-line bg-surface-raised px-4 md:block">
                  <DataTable
                    label={t('admin.nav.tracking')}
                    head={
                      <>
                        <th className={th}>{t('admin-ops.tracking.bike')}</th>
                        <th className={th}>{t('admin-ops.tracking.state')}</th>
                        <th className={th}>{t('admin-ops.tracking.client')}</th>
                        <th className={th}>{t('admin-ops.tracking.until')}</th>
                        <th className={th}>{t('admin-ops.tracking.gps')}</th>
                      </>
                    }
                  >
                    {rows.map((b) => (
                      <tr key={b.id} className="cursor-pointer hover:bg-surface" onClick={() => navigate(`/tracking/${b.id}`)}>
                        <td className={td}>
                          <Link to={`/tracking/${b.id}`} onClick={(e) => e.stopPropagation()} className="text-body-strong text-accent-text underline-offset-4 tabular hover:underline">
                            {b.plate}
                          </Link>
                          <span className="block text-caption text-ink-muted">{b.modelName}</span>
                        </td>
                        <td className={td}>
                          <Badge tone={STATE_TONE[b.state]}>{t(`admin-ops.state.${b.state}`)}</Badge>
                          <Attention items={b.attention} />
                        </td>
                        <td className={td}>
                          {b.current ? (
                            <>
                              {b.current.clientName}
                              <span className="block text-caption text-ink-muted tabular">
                                {b.current.code}
                                {b.current.phone && ` · ${b.current.phone}`}
                              </span>
                            </>
                          ) : (
                            <span className="text-ink-muted">—</span>
                          )}
                        </td>
                        <td className={`${td} whitespace-nowrap`}>
                          {b.current ? (
                            <>
                              <span className="tabular">{f.dateTime(b.current.endAt)}</span>
                              <span className="block text-caption">
                                <RentalLeft endAt={b.current.endAt} />
                              </span>
                            </>
                          ) : b.next ? (
                            <span className="text-caption text-ink-muted tabular">{t('admin-ops.tracking.nextOn', { date: f.dateTime(b.next.startAt) })}</span>
                          ) : (
                            <span className="text-ink-muted">—</span>
                          )}
                        </td>
                        <td className={td}>
                          <GpsCell bike={b} />
                        </td>
                      </tr>
                    ))}
                  </DataTable>
                </div>
                <ul className="flex flex-col gap-2 md:hidden">
                  {rows.map((b) => (
                    <li key={b.id} className="relative">
                      {b.current?.phone && <CallLink phone={b.current.phone} className="absolute bottom-3 right-3" />}
                      <Link to={`/tracking/${b.id}`} className="block rounded-lg border border-line bg-surface-raised p-4 active:bg-surface">
                        <span className="flex items-start justify-between gap-3">
                          <span className="text-body-strong tabular">{b.plate}</span>
                          <Badge tone={STATE_TONE[b.state]}>{t(`admin-ops.state.${b.state}`)}</Badge>
                        </span>
                        <span className="mt-1 block text-body text-ink-muted">{b.modelName}</span>
                        {b.current && (
                          <span className="mt-2 block pr-12 text-body">
                            {b.current.clientName} · <RentalLeft endAt={b.current.endAt} />
                          </span>
                        )}
                        <span className="block pr-12">
                          <Attention items={b.attention} />
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}
      </LoadGate>
    </>
  );
}
