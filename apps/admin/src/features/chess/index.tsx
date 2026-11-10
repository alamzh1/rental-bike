import { useMemo, useState, type DragEvent, type MouseEvent } from 'react';
import { useCustom, useUpdate } from '@refinedev/core';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router-dom';
import { Bike as BikeIcon, ChevronLeft, ChevronRight, CircleAlert, Plus } from 'lucide-react';
import { toLocationDate, type AdminBookingDetail, type BookingStatus, type ChessBike, type ChessBooking, type ChessResponse } from '@rental/shared';
import { Badge, bookingStatusTone, Button, cn, EmptyState, Icon, Sheet, Skeleton } from '@rental/ui';
import { Alert, Field, inputClass, PageHeader, useErrorText, useFormat, useToast } from '@/app/ui';
import { addDaysToDate, barGeometry, canDrop, chessDays, windowFor } from './layout';
import { ManualBookingSheet, type ManualDraft } from './ManualBookingSheet';

const DAYS = 14;
const SHIFT = 7;
const BAR_TONE: Record<BookingStatus, string> = {
  PENDING_PAYMENT: 'bg-warning-soft text-warning',
  CONFIRMED: 'bg-accent-soft text-accent-text',
  ISSUED: 'bg-success-soft text-success',
  PROBLEM: 'bg-danger-soft text-danger',
  COMPLETED: 'bg-surface text-ink-muted',
  CANCELLED_BY_CLIENT: 'bg-surface text-ink-muted',
  CANCELLED_BY_SYSTEM: 'bg-surface text-ink-muted',
};
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Колонка байка одной ширины в заголовке и строках: длинный номер обрезается, а дни остаются ровно друг под другом. */
const NAME_COL = 'w-[140px] shrink-0 sm:w-[200px]';

/** Шахматка: байки строками, дни колонками, брони полосами; перетаскивание на другой байк; ручная бронь по клику на пустое место. */
export default function Chess() {
  const { t } = useTranslation();
  const f = useFormat();
  const toast = useToast();
  const errorText = useErrorText();
  const [params, setParams] = useSearchParams();
  const today = toLocationDate(new Date(), f.tz);
  const anchor = DATE_RE.test(params.get('d') ?? '') ? (params.get('d') as string) : addDaysToDate(today, -1);
  const win = useMemo(() => windowFor(anchor, DAYS, f.tz), [anchor, f.tz]);
  const days = useMemo(() => chessDays(win.from, DAYS, f.tz), [win.from, f.tz]);
  const { data, isLoading, isError, refetch } = useCustom<ChessResponse>({ url: '/admin/chess', method: 'get', config: { query: win } });
  const { mutate: update, isLoading: moving } = useUpdate<AdminBookingDetail>();
  const [dragged, setDragged] = useState<ChessBooking | null>(null);
  const [hover, setHover] = useState<{ bikeId: string; ok: boolean } | null>(null);
  const [selected, setSelected] = useState<ChessBooking | null>(null);
  const [target, setTarget] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<ManualDraft | null>(params.get('new') ? { modelId: '', bikeId: '', start: `${addDaysToDate(today, 1)}T10:00`, end: `${addDaysToDate(today, 2)}T10:00` } : null);

  const chess = data?.data;
  const bikes = chess?.bikes ?? [];
  const byBike = useMemo(() => {
    const m = new Map<string, ChessBooking[]>();
    for (const b of chess?.bookings ?? []) m.set(b.bikeId, [...(m.get(b.bikeId) ?? []), b]);
    return m;
  }, [chess]);
  const bikeById = useMemo(() => new Map(bikes.map((b) => [b.id, b])), [bikes]);

  const go = (d: string) => {
    const next = new URLSearchParams(params);
    next.set('d', d);
    next.delete('new');
    setParams(next, { replace: true });
  };

  const move = (b: ChessBooking, bike: ChessBike) => {
    const reason = canDrop(b, bike);
    if (reason === 'SAME') return;
    if (reason) return setError(t(`admin.errors.${reason}`));
    setError(null);
    update(
      { resource: 'bookings', id: b.id, values: { bikeId: bike.id }, successNotification: false, errorNotification: false },
      {
        onSuccess: () => {
          toast('success', t('admin.chess.moved', { code: b.code, plate: bike.plate }));
          setSelected(null);
          void refetch();
        },
        onError: (e) => setError(errorText(e)),
      },
    );
  };

  const onDragOver = (e: DragEvent, bike: ChessBike) => {
    if (!dragged) return;
    const ok = canDrop(dragged, bike) === null;
    if (ok) e.preventDefault();
    if (hover?.bikeId !== bike.id || hover.ok !== ok) setHover({ bikeId: bike.id, ok });
  };

  const onDrop = (e: DragEvent, bike: ChessBike) => {
    e.preventDefault();
    if (dragged) move(dragged, bike);
    setDragged(null);
    setHover(null);
  };

  const newAt = (e: MouseEvent<HTMLDivElement>, bike: ChessBike) => {
    if (e.target !== e.currentTarget || bike.status === 'RETIRED') return;
    const rect = e.currentTarget.getBoundingClientRect();
    const i = Math.min(DAYS - 1, Math.max(0, Math.floor(((e.clientX - rect.left) / rect.width) * DAYS)));
    const date = days[i]!.date;
    setDraft({ modelId: bike.modelId, bikeId: bike.id, start: `${date}T10:00`, end: `${addDaysToDate(date, 1)}T10:00` });
  };

  const eligible = selected ? bikes.filter((b) => canDrop(selected, b) === null) : [];

  return (
    <>
      <PageHeader
        title={t('admin.chess.title')}
        meta={t('admin.chess.hint')}
        actions={
          <>
            <div className="flex items-center gap-1" role="group" aria-label={t('admin.chess.title')}>
              <Button variant="secondary" size="sm" icon={ChevronLeft} iconPosition="start" onClick={() => go(addDaysToDate(anchor, -SHIFT))}>
                {t('admin.chess.prev')}
              </Button>
              <Button variant="secondary" size="sm" onClick={() => go(addDaysToDate(today, -1))}>
                {t('admin.chess.today')}
              </Button>
              <Button variant="secondary" size="sm" icon={ChevronRight} onClick={() => go(addDaysToDate(anchor, SHIFT))}>
                {t('admin.chess.next')}
              </Button>
            </div>
            <Button icon={Plus} iconPosition="start" onClick={() => setDraft({ modelId: bikes[0]?.modelId ?? '', bikeId: '', start: `${addDaysToDate(today, 1)}T10:00`, end: `${addDaysToDate(today, 2)}T10:00` })}>
              {t('admin.bookings.new')}
            </Button>
          </>
        }
      />
      {error && (
        <div className="mb-4">
          <Alert onClose={() => setError(null)} closeLabel={t('admin.common.close')}>
            {error}
          </Alert>
        </div>
      )}

      {isError ? (
        <EmptyState icon={CircleAlert} tone="danger" title={t('admin.common.errorTitle')} action={{ label: t('admin.common.retry'), onClick: () => void refetch() }} className="py-16" />
      ) : isLoading || !chess ? (
        <div aria-busy="true" className="flex flex-col gap-2">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-12" />
          ))}
        </div>
      ) : bikes.length === 0 ? (
        <EmptyState icon={BikeIcon} title={t('admin.chess.noBikes')} text={t('admin.chess.noBikesText')} className="py-16" />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-line bg-surface-raised" aria-busy={moving || undefined}>
          <div className="min-w-[1080px]" role="grid" aria-label={t('admin.chess.title')} aria-rowcount={bikes.length + 1}>
            <div role="row" className="sticky top-0 z-10 flex border-b border-line bg-surface-raised">
              <div role="columnheader" className={`sticky left-0 z-10 ${NAME_COL} border-r border-line bg-surface-raised px-3 py-2 text-caption font-bold text-ink-muted`}>
                {t('admin.chess.bike')}
              </div>
              <div className="grid min-w-0 flex-1" style={{ gridTemplateColumns: `repeat(${DAYS}, minmax(0, 1fr))` }}>
                {days.map((d) => {
                  const isToday = d.date === today;
                  return (
                    <div key={d.date} role="columnheader" className={cn('border-r border-line px-2 py-2 text-caption last:border-r-0', isToday ? 'bg-accent-soft text-accent-text font-bold' : 'text-ink-muted')}>
                      <span className="block capitalize">{new Intl.DateTimeFormat(f.lang, { weekday: 'short', timeZone: f.tz }).format(d.start)}</span>
                      <span className="tabular text-ink">{new Intl.DateTimeFormat(f.lang, { day: 'numeric', month: 'short', timeZone: f.tz }).format(d.start)}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {bikes.map((bike) => {
              const rowHover = hover?.bikeId === bike.id ? (hover.ok ? 'bg-accent-soft' : 'bg-danger-soft') : '';
              return (
                <div key={bike.id} role="row" className="flex border-b border-line last:border-b-0">
                  <div role="rowheader" title={`${bike.plate} · ${bike.modelName}`} className={`sticky left-0 z-[5] flex ${NAME_COL} flex-col justify-center border-r border-line bg-surface-raised px-3 py-1.5`}>
                    <span className="truncate text-body-strong tabular" data-allow-truncate>{bike.plate}</span>
                    <span className="flex min-w-0 items-center gap-1.5 text-caption text-ink-muted">
                      <span className="truncate" data-allow-truncate>{bike.modelName}</span>
                      {bike.status === 'REPAIR' && <Badge tone="warning" plain>{t('admin.chess.repair')}</Badge>}
                      {bike.status === 'RETIRED' && <Badge plain>{t('admin.chess.retired')}</Badge>}
                    </span>
                  </div>
                  <div
                    role="gridcell"
                    className={cn('relative h-14 min-w-0 flex-1 cursor-cell transition-colors duration-fast', rowHover, bike.status === 'RETIRED' && 'cursor-not-allowed bg-surface')}
                    style={{ backgroundImage: 'linear-gradient(to right, var(--line) 1px, transparent 1px)', backgroundSize: `${100 / DAYS}% 100%` }}
                    onClick={(e) => newAt(e, bike)}
                    onDragOver={(e) => onDragOver(e, bike)}
                    onDragLeave={() => setHover(null)}
                    onDrop={(e) => onDrop(e, bike)}
                    title={bike.status === 'RETIRED' ? undefined : t('admin.chess.addHere', { plate: bike.plate })}
                  >
                    {(byBike.get(bike.id) ?? []).map((b) => {
                      const g = barGeometry(b, win);
                      if (!g) return null;
                      const label = t('admin.chess.bar', { code: b.code, client: b.clientName, status: t(`admin.status.${b.status}`) });
                      return (
                        <div key={b.id} className="pointer-events-none absolute inset-y-1.5 flex" style={{ left: `${g.left}%`, width: `${g.width + g.buffer}%` }}>
                          <button
                            type="button"
                            draggable
                            aria-label={label}
                            title={`${label}\n${f.dateTime(b.startAt)} → ${f.dateTime(b.endAt)}`}
                            onDragStart={(e) => {
                              e.dataTransfer.effectAllowed = 'move';
                              e.dataTransfer.setData('text/plain', b.id);
                              setDragged(b);
                            }}
                            onDragEnd={() => {
                              setDragged(null);
                              setHover(null);
                            }}
                            onClick={() => {
                              setSelected(b);
                              setTarget('');
                            }}
                            className={cn(
                              'pointer-events-auto flex h-full min-w-0 cursor-grab items-center overflow-hidden px-2 text-left text-caption font-bold active:cursor-grabbing',
                              g.clippedStart ? 'rounded-r-xs' : 'rounded-xs',
                              BAR_TONE[b.status],
                              dragged?.id === b.id && 'opacity-50',
                            )}
                            style={{ width: g.width + g.buffer > 0 ? `${(g.width / (g.width + g.buffer)) * 100}%` : '100%' }}
                          >
                            <span className="truncate tabular">{b.code}</span>
                            <span className="ml-1 truncate font-medium">{b.clientName}</span>
                          </button>
                          {g.buffer > 0 && <span aria-hidden className="h-full flex-1 rounded-r-xs bg-line" title={t('admin.chess.buffer')} />}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <Sheet
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected ? t('admin.chess.moveTitle', { code: selected.code }) : ''}
        closeLabel={t('admin.common.close')}
        footer={
          <div className="flex gap-2">
            <Link to={selected ? `/bookings/${selected.id}` : '#'} className="inline-flex h-control-lg flex-1 items-center justify-center rounded-md bg-surface px-4 text-button text-ink">
              {t('admin.chess.openBooking')}
            </Link>
            <Button size="lg" className="flex-1" disabled={!target} loading={moving} onClick={() => selected && bikeById.get(target) && move(selected, bikeById.get(target)!)}>
              {t('admin.chess.move')}
            </Button>
          </div>
        }
      >
        {selected && (
          <div className="flex flex-col gap-4 pb-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={bookingStatusTone(selected.status)}>{t(`admin.status.${selected.status}`)}</Badge>
              <span className="text-body">{selected.clientName}</span>
            </div>
            <p className="text-body tabular">
              {f.dateTime(selected.startAt)} → {f.dateTime(selected.endAt)}
            </p>
            <p className="text-caption text-ink-muted">
              <Icon icon={BikeIcon} size={16} /> {bikeById.get(selected.bikeId)?.modelName} · <span className="tabular">{bikeById.get(selected.bikeId)?.plate}</span>
            </p>
            <Field label={t('admin.chess.moveTo')} htmlFor="move-to">
              <select id="move-to" value={target} onChange={(e) => setTarget(e.target.value)} className={inputClass} disabled={eligible.length === 0}>
                <option value="">{t('admin.common.none')}</option>
                {eligible.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.plate}
                    {b.status === 'REPAIR' ? ` · ${t('admin.chess.repair')}` : ''}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        )}
      </Sheet>

      <ManualBookingSheet
        open={!!draft}
        draft={draft ?? { modelId: '', bikeId: '', start: '', end: '' }}
        bikes={bikes}
        onClose={() => setDraft(null)}
        onCreated={() => {
          setDraft(null);
          void refetch();
        }}
      />
    </>
  );
}
