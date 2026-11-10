import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Users } from 'lucide-react';
import { pickText } from '@rental/i18n';
import type { AdminSupervision, AdminSupervisionPoint, Lang } from '@rental/shared';
import { Badge, Button, EmptyState, type BadgeTone } from '@rental/ui';
import { selectPoint } from '@/app/api';
import { PageHeader, Panel, useFormat } from '@/app/ui';
import { LoadGate, useAdminGet } from '@/features/fleet/kit';

const PAYOS_TONE: Record<AdminSupervisionPoint['payosAccount'], BadgeTone> = { own: 'success', platform: 'neutral', test: 'warning', off: 'warning' };

function Metric({ label, value, alert }: { label: string; value: string; alert?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-caption text-ink-muted">{label}</dt>
      <dd className={`m-0 text-body-strong tabular ${alert ? 'text-danger' : ''}`}>{value}</dd>
    </div>
  );
}

/** Точка глазами администратора: кнопки переводят всю админку на неё, данные те же, что видит владелец. */
function PointCard({ p, days }: { p: AdminSupervisionPoint; days: number }) {
  const { t, i18n } = useTranslation();
  const f = useFormat();
  const open = (path: string) => {
    selectPoint(p.locationId);
    window.location.assign(path);
  };
  return (
    <Panel
      title={pickText(p.name, i18n.language as Lang)}
      actions={
        <span className="flex flex-wrap items-center gap-2">
          {!p.isActive && <Badge tone="neutral">{t('admin-fleet.locations.closed')}</Badge>}
          <Badge tone={PAYOS_TONE[p.payosAccount]}>{t(`admin-fleet.locations.payos.account.${p.payosAccount}`)}</Badge>
        </span>
      }
    >
      <p className="text-caption text-ink-muted">{p.address}</p>
      <p className="mt-1 text-body">{p.owners.length ? t('admin.owners.owner', { names: p.owners.join(', ') }) : <span className="text-danger">{t('admin.owners.noOwner')}</span>}</p>
      {p.managers.length > 0 && <p className="text-caption text-ink-muted">{t('admin.owners.managers', { names: p.managers.join(', ') })}</p>}
      <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metric label={t('admin.owners.income')} value={f.money(p.income)} />
        <Metric label={t('admin.owners.profit')} value={f.money(p.profit)} />
        <Metric label={t('admin.owners.bikes')} value={String(p.bikes)} />
        <Metric label={t('admin.owners.rentals')} value={String(p.activeRentals)} />
        <Metric label={t('admin.owners.overdue')} value={String(p.overdue)} alert={p.overdue > 0} />
        <Metric label={t('admin.owners.openIncidents')} value={String(p.openIncidents)} alert={p.openIncidents > 0} />
        <Metric label={t('admin.owners.recentIncidents', { days })} value={String(p.recentIncidents)} />
        <Metric label={t('admin.owners.refunds')} value={f.money(p.pendingRefunds)} alert={p.pendingRefunds > 0} />
        <Metric label={t('admin.owners.outstanding')} value={f.money(p.outstanding)} />
        <Metric label={t('admin.owners.noPhotos')} value={String(p.withoutPhotoAct)} alert={p.withoutPhotoAct > 0} />
        <Metric label={t('admin.owners.lastActivity')} value={p.lastActivityAt ? f.dateTime(p.lastActivityAt) : t('admin.owners.never')} />
      </dl>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button size="sm" onClick={() => open('/')}>{t('admin.owners.openPoint')}</Button>
        <Button size="sm" variant="secondary" onClick={() => open('/finance')}>{t('admin.nav.finance')}</Button>
        <Button size="sm" variant="secondary" onClick={() => open('/acts')}>{t('admin.nav.acts')}</Button>
        <Button size="sm" variant="secondary" onClick={() => open('/audit')}>{t('admin.nav.audit')}</Button>
      </div>
    </Panel>
  );
}

/** Контроль владельцев: цифры и нарушения по каждой точке и случаи, ждущие решения. */
export default function Owners() {
  const { t, i18n } = useTranslation();
  const f = useFormat();
  const q = useAdminGet<AdminSupervision>('/admin/supervision');
  const d = q.data;
  return (
    <>
      <PageHeader title={t('admin.nav.owners')} meta={t('admin.owners.meta')} />
      <LoadGate isLoading={q.isLoading} isError={q.isError} onRetry={() => void q.refetch()}>
        {d && d.openIncidents.length > 0 && (
          <Panel title={t('admin.owners.incidentsTitle', { count: d.openIncidents.length })} className="mb-6">
            <ul className="flex flex-col divide-y divide-line">
              {d.openIncidents.map((i) => (
                <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span className="min-w-0">
                    <Link to={`/bookings/${i.bookingId}`} className="text-body-strong text-accent-text underline-offset-4 hover:underline">{i.code}</Link>
                    <span className="text-body"> · {i.modelName} · {pickText(i.pointName, i18n.language as Lang)}</span>
                    <span className="block text-caption text-ink-muted tabular">{f.dateTime(i.createdAt)} · {t(`admin.incident.source.${i.source}`)}</span>
                  </span>
                  {i.escalated && <Badge tone="danger">{t('admin.owners.noAnswer')}</Badge>}
                </li>
              ))}
            </ul>
          </Panel>
        )}
        {(d?.points.length ?? 0) === 0 ? (
          <EmptyState icon={Users} title={t('admin-fleet.locations.empty')} className="py-12" />
        ) : (
          <div className="flex flex-col gap-4">{d?.points.map((p) => <PointCard key={p.locationId} p={p} days={d.incidentDays} />)}</div>
        )}
      </LoadGate>
    </>
  );
}
