import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Bike as BikeIcon, Plus } from 'lucide-react';
import type { AdminListOf, AdminModel } from '@rental/shared';
import { Badge, Button, EmptyState } from '@rental/ui';
import { DataTable, td, th, useFormat } from '@/app/ui';
import { DemoTag, LoadGate, Meta, useAdminGet } from './kit';
import { ModelSheet } from './ModelSheet';

function Thumb({ m }: { m: AdminModel }) {
  const p = m.photos[0];
  const src = p?.sizes['400']?.webp ?? p?.url;
  return (
    <span className="flex h-12 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xs bg-surface">
      {src ? <img src={src} alt="" className="h-full w-full object-contain" loading="lazy" /> : <BikeIcon size={20} className="text-line-strong" aria-hidden />}
    </span>
  );
}

/** Модели парка. Менеджер видит модели своей точки без цен и не редактирует их. */
export function Models({ isAdmin }: { isAdmin: boolean }) {
  const { t } = useTranslation();
  const f = useFormat();
  const q = useAdminGet<AdminListOf<AdminModel>>('/admin/models');
  const [open, setOpen] = useState<AdminModel | 'new' | null>(null);
  const rows = q.data?.items ?? [];

  return (
    <>
      {isAdmin && (
        <div className="mb-4 flex justify-end">
          <Button variant="secondary" icon={Plus} onClick={() => setOpen('new')}>
            {t('admin-fleet.models.add')}
          </Button>
        </div>
      )}
      <LoadGate isLoading={q.isLoading} isError={q.isError} onRetry={() => void q.refetch()}>
        {rows.length === 0 ? (
          <EmptyState icon={BikeIcon} title={t('admin-fleet.models.empty')} text={t('admin-fleet.models.emptyText')} className="py-12" />
        ) : (
          <>
            <div className="hidden rounded-lg border border-line bg-surface-raised px-4 md:block">
              <DataTable
                label={t('admin-fleet.fleet.tab.models')}
                head={
                  <>
                    <th className={th}>{t('admin-fleet.models.col.model')}</th>
                    <th className={th}>{t('admin-fleet.models.col.category')}</th>
                    <th className={`${th} text-right`}>{t('admin-fleet.models.col.bikes')}</th>
                    {isAdmin && <th className={`${th} text-right`}>{t('admin-fleet.models.col.deposit')}</th>}
                    {isAdmin && <th className={`${th} text-right`}>{t('admin-fleet.models.col.price')}</th>}
                    <th className={th}>{t('admin-fleet.models.col.state')}</th>
                  </>
                }
              >
                {rows.map((m) => (
                  <tr key={m.id} className={isAdmin ? 'cursor-pointer hover:bg-surface' : undefined} onClick={isAdmin ? () => setOpen(m) : undefined}>
                    <td className={td}>
                      <span className="flex items-center gap-3">
                        <Thumb m={m} />
                        <span className="min-w-0">
                          {isAdmin ? (
                            <button type="button" className="text-body-strong text-accent-text underline-offset-4 hover:underline" onClick={() => setOpen(m)}>
                              {m.name}
                            </button>
                          ) : (
                            <span className="text-body-strong">{m.name}</span>
                          )}
                          <span className="block text-caption text-ink-muted">
                            {m.brandName}
                            {m.engineCc ? ` · ${m.engineCc} cc` : ''}
                          </span>
                        </span>
                      </span>
                    </td>
                    <td className={td}>{t(`admin-fleet.category.${m.category}`)}</td>
                    <td className={`${td} text-right tabular`}>{m.bikeCount}</td>
                    {isAdmin && <td className={`${td} whitespace-nowrap text-right tabular`}>{m.deposit !== undefined ? f.money(m.deposit) : '—'}</td>}
                    {isAdmin && <td className={`${td} whitespace-nowrap text-right tabular`}>{m.tariffs?.[0] ? t('admin-fleet.models.perDay', { price: f.money(m.tariffs[0].pricePerDay) }) : t('admin-fleet.models.noTariffs')}</td>}
                    <td className={td}>
                      <span className="flex flex-wrap gap-1.5">
                        <Badge tone={m.isActive ? 'success' : 'neutral'}>{t(m.isActive ? 'admin-fleet.models.active' : 'admin-fleet.models.hidden')}</Badge>
                        <DemoTag show={m.isDemo} />
                      </span>
                    </td>
                  </tr>
                ))}
              </DataTable>
            </div>
            <ul className="flex flex-col gap-2 md:hidden">
              {rows.map((m) => (
                <li key={m.id}>
                  <button type="button" disabled={!isAdmin} onClick={() => setOpen(m)} className="block w-full rounded-lg border border-line bg-surface-raised p-4 text-left active:bg-surface disabled:active:bg-surface-raised">
                    <span className="flex items-center gap-3">
                      <Thumb m={m} />
                      <span className="min-w-0 flex-1">
                        <span className="block text-body-strong">{m.name}</span>
                        <span className="block text-caption text-ink-muted">{m.brandName}</span>
                      </span>
                      <DemoTag show={m.isDemo} />
                    </span>
                    <span className="mt-3 flex flex-col gap-1">
                      <Meta label={t('admin-fleet.models.col.bikes')}>{m.bikeCount}</Meta>
                      {isAdmin && m.deposit !== undefined && <Meta label={t('admin-fleet.models.col.deposit')}>{f.money(m.deposit)}</Meta>}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </LoadGate>
      {isAdmin && open && <ModelSheet model={open === 'new' ? null : open} onClose={() => setOpen(null)} onSaved={(m) => setOpen(m)} />}
    </>
  );
}
