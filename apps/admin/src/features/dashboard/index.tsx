import { useCustom } from '@refinedev/core';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { CircleAlert } from 'lucide-react';
import type { AdminDashboard } from '@rental/shared';
import { Badge, bookingStatusTone, EmptyState, Skeleton } from '@rental/ui';
import { CallLink, PageHeader, Panel, useFormat, useMe } from '@/app/ui';
import { RentalLeft } from '@/features/tracking/RentalLeft';

/** Сводка: выдачи/возвраты сегодня, загрузка, неоплаченные; выручка (только админ); воронка за 30 дней. */
export default function Dashboard() {
  const { t } = useTranslation();
  const f = useFormat();
  const me = useMe();
  const { data, isLoading, isError, refetch } = useCustom<AdminDashboard>({ url: '/admin/dashboard', method: 'get', queryOptions: { refetchInterval: 60_000 } });
  const d = data?.data;

  if (isError) return <EmptyState icon={CircleAlert} tone="danger" title={t('admin.common.errorTitle')} action={{ label: t('admin.common.retry'), onClick: () => void refetch() }} className="py-16" />;
  if (isLoading || !d)
    return (
      <div aria-busy="true" className="flex flex-col gap-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-56" />
      </div>
    );

  const opens = d.funnel.steps[0]?.count ?? 0;
  const today = [
    { label: t('admin.dashboard.issues'), value: String(d.issuesToday) },
    { label: t('admin.dashboard.returns'), value: String(d.returnsToday) },
    { label: t('admin.dashboard.load'), value: `${d.fleetLoadPercent} %`, hint: t('admin.dashboard.loadHint', { busy: d.busyBikes, total: d.fleetSize }) },
    { label: t('admin.dashboard.unpaid'), value: String(d.unpaid.count) },
  ];

  return (
    <>
      <PageHeader
        title={t('admin.dashboard.title')}
        meta={t('admin.dashboard.today', { date: f.date(`${d.date}T12:00:00Z`) })}
        actions={
          <Link to="/chess" className="inline-flex h-control-md items-center rounded-md bg-surface px-5 text-button text-ink">
            {t('admin.dashboard.openChess')}
          </Link>
        }
      />

      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line lg:grid-cols-4">
        {today.map((s) => (
          <div key={s.label} className="bg-surface-raised p-4">
            <dt className="text-caption text-ink-muted">{s.label}</dt>
            <dd className="mt-1 text-title-1 tabular">{s.value}</dd>
            {s.hint && <dd className="text-caption text-ink-muted">{s.hint}</dd>}
          </div>
        ))}
      </dl>

      {(d.rentals.overdue.length > 0 || d.rentals.endingSoon.length > 0) && (
        <Panel title={t('admin-ops.ending.title')} className="mt-6" bodyClassName="p-0">
          <ul>
            {[...d.rentals.overdue, ...d.rentals.endingSoon].map((b) => (
              <li key={b.id} className="flex items-center gap-2 border-b border-line pr-3 last:border-0 lg:pr-0">
                <Link to={`/bookings/${b.id}`} className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3 hover:bg-surface">
                  <span className="min-w-0">
                    <span className="text-body-strong tabular">{b.bikePlate}</span> <span className="text-body text-ink-muted">· {b.modelName} · {b.client.name}</span>
                    <span className="block text-caption text-ink-muted tabular">
                      {b.code} · {t('admin-ops.ending.returnAt', { date: f.dateTime(b.endAt) })}
                      {b.client.phone && ` · ${b.client.phone}`}
                    </span>
                  </span>
                  <span className="text-caption">
                    <RentalLeft endAt={b.endAt} />
                  </span>
                </Link>
                {b.client.phone && <CallLink phone={b.client.phone} className="lg:hidden" />}
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="flex flex-col gap-6">
          {d.revenue && (
            <Panel title={t('admin.dashboard.revenue')}>
              <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                {(['day', 'week', 'month'] as const).map((k) => (
                  <div key={k}>
                    <dt className="text-caption text-ink-muted">{t(`admin.dashboard.${k}`)}</dt>
                    <dd className="mt-1 text-price-lg tabular">{f.money(d.revenue![k])}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-4 text-caption text-ink-muted">{t('admin.dashboard.revenueHint')}</p>
            </Panel>
          )}

          <Panel title={t('admin.dashboard.unpaid')} bodyClassName="p-0">
            {d.unpaid.items.length === 0 ? (
              <p className="p-4 text-body text-ink-muted">{t('admin.dashboard.unpaidEmpty')}</p>
            ) : (
              <ul>
                {d.unpaid.items.map((b) => (
                  <li key={b.id} className="border-b border-line last:border-0">
                    <Link to={`/bookings/${b.id}`} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3 hover:bg-surface">
                      <span className="min-w-0">
                        <span className="text-body-strong tabular">{b.code}</span> <span className="text-body text-ink-muted">· {b.client.name}</span>
                        <span className="block text-caption text-ink-muted">
                          {b.modelName} · {f.dateTime(b.startAt)}
                          {b.holdExpiresAt && ` · ${t('admin.dashboard.holdUntil', { time: f.time(b.holdExpiresAt) })}`}
                        </span>
                      </span>
                      <span className="flex items-center gap-3">
                        {d.revenue && <span className="text-price tabular">{f.money(b.totalAmount + b.depositAmount)}</span>}
                        <Badge tone={bookingStatusTone(b.status)}>{t(`admin.status.${b.status}`)}</Badge>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        {me.role === 'ADMIN' && <Panel title={t('admin.dashboard.funnel', { days: d.funnel.days })}>
          <ol className="flex flex-col gap-3">
            {d.funnel.steps.map((s) => {
              const pct = opens ? Math.round((s.count * 100) / opens) : 0;
              return (
                <li key={s.name}>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-body">{t(`admin.dashboard.funnelSteps.${s.name}`)}</span>
                    <span className="text-body-strong tabular">{s.count}</span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-pill bg-surface" aria-hidden>
                    <div className="h-full rounded-pill bg-accent-text" style={{ width: `${Math.min(100, pct)}%` }} />
                  </div>
                  {s.name !== 'open' && <p className="mt-0.5 text-caption text-ink-muted">{t('admin.dashboard.ofOpens', { pct })}</p>}
                </li>
              );
            })}
          </ol>
          <h3 className="mt-6 text-body-strong">{t('admin.dashboard.sources')}</h3>
          {d.funnel.sources.length === 0 ? (
            <p className="mt-1 text-caption text-ink-muted">{t('admin.dashboard.noSources')}</p>
          ) : (
            <ul className="mt-2 flex flex-col">
              {d.funnel.sources.map((s) => (
                <li key={s.source} className="flex justify-between gap-3 border-b border-line py-2 text-body last:border-0">
                  <span className="min-w-0 break-all">{s.source}</span>
                  <span className="tabular">{s.count}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>}
      </div>
    </>
  );
}
