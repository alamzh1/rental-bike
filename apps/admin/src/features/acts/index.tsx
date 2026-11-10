import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Camera, Image as ImageIcon } from 'lucide-react';
import type { AdminActArchive, AdminActArchiveRow, AdminActPhotos, AdminHandoverAct } from '@rental/shared';
import { Button, EmptyState } from '@rental/ui';
import { api } from '@/app/providers';
import { Alert, Field, inputClass, PageHeader, Panel, useErrorText, useFormat } from '@/app/ui';
import { LoadGate, useAdminGet } from '@/features/fleet/kit';

/** Одна сторона сравнения: фото загружаются по кнопке, ссылки живут 10 минут и пишутся в журнал. */
function ActSide({ row, act, title }: { row: AdminActArchiveRow; act: AdminHandoverAct | null; title: string }) {
  const { t } = useTranslation();
  const f = useFormat();
  const errorText = useErrorText();
  const [photos, setPhotos] = useState<AdminActPhotos['photos'] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const load = async () => {
    setBusy(true);
    setError(null);
    try {
      setPhotos((await api.get<AdminActPhotos>(`/admin/bookings/${row.bookingId}/acts/${act!.id}/photos`)).photos);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="flex min-w-0 flex-col gap-2">
      <h3 className="text-body-strong">{title}</h3>
      {!act ? (
        <p className="text-body text-ink-muted">{t('admin.acts.noAct')}</p>
      ) : (
        <>
          <p className="text-caption text-ink-muted tabular">{f.dateTime(act.createdAt)}{act.managerName ? ` · ${act.managerName}` : ''}</p>
          <p className="text-body tabular">{t('admin.booking.actLine', { km: act.mileageKm, fuel: act.fuelLevel })}</p>
          {act.damages && <p className="text-body">{t('admin.booking.damages', { text: act.damages })}</p>}
          {error && <Alert>{error}</Alert>}
          {photos ? (
            <ul className="grid grid-cols-3 gap-2">
              {photos.map((p, i) => (
                <li key={p.url}>
                  <a href={p.url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-xs bg-surface">
                    <img src={p.url} alt={`${title} ${i + 1}`} className="aspect-square w-full object-cover" loading="lazy" />
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <Button variant="secondary" size="sm" icon={ImageIcon} iconPosition="start" loading={busy} className="self-start" onClick={() => void load()}>
              {t('admin.booking.showPhotos', { count: act.photoCount })}
            </Button>
          )}
        </>
      )}
    </section>
  );
}

/** Архив фотоактов точки: состояние байка до и после каждой аренды. Файлы приватные и не удаляются. */
export default function Acts() {
  const { t } = useTranslation();
  const f = useFormat();
  const [text, setText] = useState('');
  const [page, setPage] = useState(1);
  const q = useAdminGet<AdminActArchive>('/admin/acts', { q: text.trim() || undefined, page });
  const pages = q.data ? Math.max(1, Math.ceil(q.data.total / q.data.pageSize)) : 1;
  return (
    <>
      <PageHeader title={t('admin.nav.acts')} meta={t('admin.acts.meta')} />
      <div className="mb-4 max-w-[360px]">
        <Field label={t('admin.acts.search')} htmlFor="acts-q">
          <input
            id="acts-q"
            value={text}
            maxLength={40}
            onChange={(e) => {
              setText(e.target.value);
              setPage(1);
            }}
            className={inputClass}
          />
        </Field>
      </div>
      <LoadGate isLoading={q.isLoading} isError={q.isError} onRetry={() => void q.refetch()}>
        {(q.data?.items.length ?? 0) === 0 ? (
          <EmptyState icon={Camera} title={t('admin.acts.empty')} text={t('admin.acts.emptyText')} className="py-12" />
        ) : (
          <div className="flex flex-col gap-4">
            {q.data!.items.map((r) => (
              <Panel
                key={r.bookingId}
                title={`${r.plate} · ${r.modelName}`}
                actions={
                  <Link to={`/bookings/${r.bookingId}`} className="text-body text-accent-text underline-offset-4 hover:underline">
                    {r.code}
                  </Link>
                }
              >
                <p className="mb-3 text-caption text-ink-muted tabular">{r.clientName} · {f.dateTime(r.startAt)} — {f.dateTime(r.endAt)}</p>
                <div className="grid gap-6 md:grid-cols-2">
                  <ActSide row={r} act={r.before} title={t('admin.acts.before')} />
                  <ActSide row={r} act={r.after} title={t('admin.acts.after')} />
                </div>
              </Panel>
            ))}
            {pages > 1 && (
              <div className="flex items-center justify-between gap-3">
                <Button variant="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>{t('admin.acts.prev')}</Button>
                <span className="text-body tabular">{page} / {pages}</span>
                <Button variant="secondary" disabled={page >= pages} onClick={() => setPage(page + 1)}>{t('admin.acts.next')}</Button>
              </div>
            )}
          </div>
        )}
      </LoadGate>
    </>
  );
}
