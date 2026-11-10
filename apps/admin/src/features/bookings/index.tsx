import { useList } from '@refinedev/core';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { CircleAlert, ClipboardList, Plus, Search } from 'lucide-react';
import { canSeeMoney, BOOKING_STATUSES, type AdminBookingRow } from '@rental/shared';
import { Badge, bookingStatusTone, Button, Chip, EmptyState, Icon, Skeleton } from '@rental/ui';
import { DataTable, Field, inputClass, PageHeader, td, th, useFormat, useMe } from '@/app/ui';
import { parseBookingFilters, toApiQuery, toSearch, PAGE_SIZE, type BookingFilters } from './filters';

/** Список броней: фильтры по статусу, датам (пересечение периода), поиску; таблица на десктопе, карточки на телефоне. */
export default function Bookings() {
  const me = useMe();
  const { t } = useTranslation();
  const f = useFormat();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const filters = parseBookingFilters(params);
  const set = (patch: Partial<BookingFilters>) => setParams(toSearch({ ...filters, page: 1, ...patch }), { replace: true });
  const { data, isLoading, isError, refetch } = useList<AdminBookingRow>({ resource: 'bookings', pagination: { mode: 'off' }, meta: { query: toApiQuery(filters, f.tz) } });
  const rows = data?.data ?? [];
  const total = data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const filtered = filters.status.length > 0 || !!filters.from || !!filters.to || !!filters.q;

  const toggle = (s: (typeof BOOKING_STATUSES)[number]) => set({ status: filters.status.includes(s) ? filters.status.filter((x) => x !== s) : [...filters.status, s] });

  return (
    <>
      <PageHeader
        title={t('admin.bookings.title')}
        meta={!isLoading ? t('admin.bookings.count', { count: total }) : undefined}
        actions={
          <Button icon={Plus} iconPosition="start" onClick={() => navigate('/chess?new=1')}>
            {t('admin.bookings.new')}
          </Button>
        }
      />

      <div className="mb-4 flex flex-col gap-4">
        <div role="group" aria-label={t('admin.bookings.statusFilter')} className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
          <Chip selected={filters.status.length === 0} onClick={() => set({ status: [] })}>
            {t('admin.bookings.allStatuses')}
          </Chip>
          {BOOKING_STATUSES.map((s) => (
            <Chip key={s} selected={filters.status.includes(s)} onClick={() => toggle(s)} aria-pressed={filters.status.includes(s)}>
              {t(`admin.status.${s}`)}
            </Chip>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_auto] md:items-end">
          <div className="col-span-2 md:col-span-1">
            <Field label={t('admin.bookings.search')} htmlFor="q">
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted">
                  <Icon icon={Search} size={16} />
                </span>
                <input key={filters.q} id="q" type="search" defaultValue={filters.q} onKeyDown={(e) => e.key === 'Enter' && set({ q: e.currentTarget.value })} onBlur={(e) => e.currentTarget.value !== filters.q && set({ q: e.currentTarget.value })} className={`${inputClass} pl-9`} />
              </div>
            </Field>
          </div>
          <Field label={t('admin.bookings.from')} htmlFor="from">
            <input id="from" type="date" value={filters.from} onChange={(e) => set({ from: e.target.value })} className={inputClass} />
          </Field>
          <Field label={t('admin.bookings.to')} htmlFor="to">
            <input id="to" type="date" value={filters.to} min={filters.from || undefined} onChange={(e) => set({ to: e.target.value })} className={inputClass} />
          </Field>
          {filtered && (
            <Button variant="ghost" className="col-span-2 justify-self-start md:col-span-1" onClick={() => setParams('', { replace: true })}>
              {t('admin.common.reset')}
            </Button>
          )}
        </div>
      </div>

      {isError ? (
        <EmptyState icon={CircleAlert} tone="danger" title={t('admin.common.errorTitle')} action={{ label: t('admin.common.retry'), onClick: () => void refetch() }} className="py-12" />
      ) : isLoading ? (
        <div aria-busy="true" className="flex flex-col gap-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-14" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        filtered ? (
          <EmptyState icon={Search} title={t('admin.bookings.emptyFiltered')} text={t('admin.bookings.emptyFilteredText')} action={{ label: t('admin.common.reset'), onClick: () => setParams('', { replace: true }) }} className="py-12" />
        ) : (
          <EmptyState icon={ClipboardList} title={t('admin.bookings.empty')} text={t('admin.bookings.emptyText')} className="py-12" />
        )
      ) : (
        <>
          <div className="hidden rounded-lg border border-line bg-surface-raised px-4 md:block">
            <DataTable
              label={t('admin.bookings.title')}
              head={
                <>
                  <th className={th}>{t('admin.bookings.col.code')}</th>
                  <th className={th}>{t('admin.bookings.col.client')}</th>
                  <th className={th}>{t('admin.bookings.col.bike')}</th>
                  <th className={th}>{t('admin.bookings.col.period')}</th>
                  <th className={th}>{t('admin.bookings.col.status')}</th>
                  <th className={`${th} text-right`}>{t('admin.bookings.col.amount')}</th>
                </>
              }
            >
              {rows.map((b) => (
                <tr key={b.id} className="hover:bg-surface">
                  <td className={td}>
                    <Link to={`/bookings/${b.id}`} className="text-body-strong text-accent-text underline-offset-4 hover:underline">
                      {b.code}
                    </Link>
                  </td>
                  <td className={td}>
                    {b.client.name}
                    <span className="block text-caption text-ink-muted">
                      {b.client.phone ?? (b.client.username ? `@${b.client.username}` : '')}
                      {b.client.walkIn && ` · ${t('admin.bookings.walkIn')}`}
                    </span>
                  </td>
                  <td className={td}>
                    {b.modelName}
                    <span className="block text-caption text-ink-muted tabular">{b.bikePlate}</span>
                  </td>
                  <td className={`${td} whitespace-nowrap tabular`}>
                    {f.dateTime(b.startAt)}
                    <span className="block text-caption text-ink-muted">{f.dateTime(b.endAt)}</span>
                  </td>
                  <td className={td}>
                    <Badge tone={bookingStatusTone(b.status)}>{t(`admin.status.${b.status}`)}</Badge>
                  </td>
                  <td className={`${td} whitespace-nowrap text-right tabular`}>
                    {canSeeMoney(me.role) && f.money(b.totalAmount)}
                    <span className="block text-caption text-ink-muted">{t(`admin.booking.method.${b.paymentMethod}`)}</span>
                  </td>
                </tr>
              ))}
            </DataTable>
          </div>

          <ul className="flex flex-col gap-2 md:hidden">
            {rows.map((b) => (
              <li key={b.id}>
                <Link to={`/bookings/${b.id}`} className="block rounded-lg border border-line bg-surface-raised p-4 active:bg-surface">
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-body-strong tabular">{b.code}</span>
                    <Badge tone={bookingStatusTone(b.status)}>{t(`admin.status.${b.status}`)}</Badge>
                  </div>
                  <p className="mt-1 text-body">
                    {b.client.name} · {b.modelName} <span className="text-ink-muted tabular">{b.bikePlate}</span>
                  </p>
                  <p className="mt-1 flex justify-between gap-3 text-caption text-ink-muted tabular">
                    <span>
                      {f.dateTime(b.startAt)} → {f.dateTime(b.endAt)}
                    </span>
                    {canSeeMoney(me.role) && <span className="text-ink">{f.money(b.totalAmount)}</span>}
                  </p>
                </Link>
              </li>
            ))}
          </ul>

          {pages > 1 && (
            <nav className="mt-4 flex items-center justify-between gap-3" aria-label={t('admin.common.page', { page: filters.page, pages })}>
              <Button variant="secondary" size="sm" disabled={filters.page <= 1} onClick={() => set({ page: filters.page - 1 })}>
                {t('admin.common.prev')}
              </Button>
              <span className="text-caption text-ink-muted tabular">{t('admin.common.page', { page: filters.page, pages })}</span>
              <Button variant="secondary" size="sm" disabled={filters.page >= pages} onClick={() => set({ page: filters.page + 1 })}>
                {t('admin.common.next')}
              </Button>
            </nav>
          )}
        </>
      )}
    </>
  );
}
