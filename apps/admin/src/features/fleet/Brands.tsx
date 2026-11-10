import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Tags } from 'lucide-react';
import type { AdminBrand, AdminListOf } from '@rental/shared';
import { Button, EmptyState } from '@rental/ui';
import { api } from '@/app/providers';
import { Alert, Field, inputClass, Panel } from '@/app/ui';
import { ImagePicker, LoadGate, uploadFile, useAdminGet, useAdminSave } from './kit';

/** Бренды: название и логотип (WebP). Без логотипа в Mini App показывается название — логотипы не выдумываются. */
export function Brands({ isAdmin }: { isAdmin: boolean }) {
  const { t } = useTranslation();
  const q = useAdminGet<AdminListOf<AdminBrand>>('/admin/brands');
  const [name, setName] = useState('');
  const add = useAdminSave((n: string) => api.post<AdminBrand>('/admin/brands', { name: n }), { success: t('admin-fleet.brands.added'), invalidate: ['/admin/brands'] });
  const logo = useAdminSave((v: { id: string; file: File }) => uploadFile<AdminBrand>(`/admin/brands/${v.id}/logo`, v.file), { success: t('admin-fleet.brands.logoSaved'), invalidate: ['/admin/brands'] });
  const rows = q.data?.items ?? [];

  return (
    <div className="flex flex-col gap-6">
      {isAdmin && (
        <Panel title={t('admin-fleet.brands.add')}>
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (name.trim()) add.mutate(name.trim(), { onSuccess: () => setName('') });
            }}
          >
            <div className="min-w-[200px] flex-1">
              <Field label={t('admin-fleet.brands.name')} htmlFor="brand-name">
                <input id="brand-name" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} className={inputClass} />
              </Field>
            </div>
            <Button type="submit" variant="secondary" loading={add.isLoading} disabled={!name.trim()}>
              {t('admin-fleet.brands.addButton')}
            </Button>
          </form>
          {add.error && (
            <div className="mt-3">
              <Alert>{add.error}</Alert>
            </div>
          )}
        </Panel>
      )}
      {logo.error && <Alert>{logo.error}</Alert>}
      <LoadGate isLoading={q.isLoading} isError={q.isError} onRetry={() => void q.refetch()}>
        {rows.length === 0 ? (
          <EmptyState icon={Tags} title={t('admin-fleet.brands.empty')} className="py-12" />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {rows.map((b) => (
              <li key={b.id} className="flex items-center gap-4 rounded-lg border border-line bg-surface-raised p-4">
                <span className="flex h-14 w-20 shrink-0 items-center justify-center overflow-hidden rounded-sm bg-surface">
                  {b.logoUrl ? <img src={b.logoUrl} alt={b.name} className="max-h-10 max-w-16 object-contain" /> : <span className="text-label text-ink-muted">{b.name}</span>}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-body-strong">{b.name}</span>
                  {!b.logoUrl && <span className="block text-caption text-ink-muted">{t('admin-fleet.brands.noLogo')}</span>}
                  {isAdmin && (
                    <span className="mt-2 block">
                      <ImagePicker label={b.logoUrl ? t('admin-fleet.brands.replaceLogo') : t('admin-fleet.brands.uploadLogo')} accept="image/png,image/webp,image/svg+xml,image/jpeg" loading={logo.isLoading && logo.variables?.id === b.id} onPick={(file) => logo.mutate({ id: b.id, file })} />
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </LoadGate>
    </div>
  );
}
