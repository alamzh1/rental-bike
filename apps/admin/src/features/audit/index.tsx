import { useList } from '@refinedev/core';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router-dom';
import { CircleAlert, History } from 'lucide-react';
import type { AuditEntry } from '@rental/shared';
import { Button, EmptyState, Skeleton } from '@rental/ui';
import { DataTable, PageHeader, td, th, useFormat } from '@/app/ui';

const PAGE_SIZE = 50;

function details(diff: Record<string, unknown> | null): string {
  if (!diff) return '';
  return Object.entries(diff)
    .filter(([, v]) => v !== null && v !== undefined && v !== '')
    .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`)
    .join(' · ');
}

/** Журнал действий сотрудников (AuditLog), новые сверху. Только администратор. */
export default function Audit() {
  const { t } = useTranslation();
  const f = useFormat();
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Number(params.get('page')) || 1);
  const { data, isLoading, isError, refetch } = useList<AuditEntry>({ resource: 'audit', pagination: { mode: 'off' }, meta: { query: { page: String(page) } } });
  const rows = data?.data ?? [];
  const pages = Math.max(1, Math.ceil((data?.total ?? 0) / PAGE_SIZE));
  const setPage = (p: number) => setParams(p > 1 ? `page=${p}` : '', { replace: true });

  return (
    <>
      <PageHeader title={t('admin.audit.title')} />
      {isError ? (
        <EmptyState icon={CircleAlert} tone="danger" title={t('admin.common.errorTitle')} action={{ label: t('admin.common.retry'), onClick: () => void refetch() }} className="py-16" />
      ) : isLoading ? (
        <div aria-busy="true" className="flex flex-col gap-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-10" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState icon={History} title={t('admin.audit.empty')} text={t('admin.audit.emptyText')} className="py-16" />
      ) : (
        <div className="rounded-lg border border-line bg-surface-raised px-4">
          <DataTable
            label={t('admin.audit.title')}
            head={
              <>
                <th className={th}>{t('admin.audit.col.at')}</th>
                <th className={th}>{t('admin.audit.col.actor')}</th>
                <th className={th}>{t('admin.audit.col.action')}</th>
                <th className={th}>{t('admin.audit.col.entity')}</th>
                <th className={th}>{t('admin.audit.col.details')}</th>
              </>
            }
          >
            {rows.map((r) => (
              <tr key={r.id}>
                <td className={`${td} whitespace-nowrap tabular`}>{f.dateTime(r.at)}</td>
                <td className={td}>
                  {r.actor ? r.actor.name : t('admin.audit.system')}
                  {r.actor && <span className="block text-caption text-ink-muted">{t(`admin.roles.${r.actor.role}`, { defaultValue: r.actor.role })}</span>}
                </td>
                <td className={`${td} whitespace-nowrap font-bold`}>{r.action}</td>
                <td className={td}>
                  {r.entity === 'Booking' && r.entityId ? (
                    <Link to={`/bookings/${r.entityId}`} className="text-accent-text underline-offset-4 hover:underline">
                      {r.entity}
                    </Link>
                  ) : (
                    r.entity
                  )}
                </td>
                <td className={`${td} max-w-[420px] break-words text-caption text-ink-muted`}>{details(r.diff)}</td>
              </tr>
            ))}
          </DataTable>
        </div>
      )}
      {pages > 1 && (
        <nav className="mt-4 flex items-center justify-between gap-3" aria-label={t('admin.common.page', { page, pages })}>
          <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            {t('admin.common.prev')}
          </Button>
          <span className="text-caption text-ink-muted tabular">{t('admin.common.page', { page, pages })}</span>
          <Button variant="secondary" size="sm" disabled={page >= pages} onClick={() => setPage(page + 1)}>
            {t('admin.common.next')}
          </Button>
        </nav>
      )}
    </>
  );
}
