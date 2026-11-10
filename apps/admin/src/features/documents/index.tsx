import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ExternalLink, FileCheck } from 'lucide-react';
import type { AdminDocumentList, AdminDocumentRow, DocumentUrlResponse } from '@rental/shared';
import { Badge, Button, Chip, ChipGroup, EmptyState, type BadgeTone } from '@rental/ui';
import { api } from '@/app/providers';
import { Alert, Field, inputClass, PageHeader, useErrorText, useFormat } from '@/app/ui';
import { LoadGate, useAdminGet, useAdminSave } from '@/features/fleet/kit';

const FILTERS = ['UPLOADED', 'VERIFIED', 'REJECTED'] as const;
const TONE: Record<AdminDocumentRow['status'], BadgeTone> = { UPLOADED: 'warning', VERIFIED: 'success', REJECTED: 'danger' };

/** Один документ: файл открывается временной ссылкой (выдача пишется в журнал), решение уходит клиенту при отклонении. */
function DocumentCard({ d }: { d: AdminDocumentRow }) {
  const { t } = useTranslation();
  const f = useFormat();
  const errorText = useErrorText();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const save = useAdminSave((v: { status: 'VERIFIED' | 'REJECTED'; rejectReason?: string }) => api.post(`/admin/documents/${d.id}/verify`, v), { success: t('admin.documents.saved'), invalidate: ['/admin/documents'] });
  const open = async () => {
    setError(null);
    // Окно открывается сразу по нажатию: после ожидания сети браузер его заблокирует
    const tab = window.open('', '_blank');
    try {
      const { url } = await api.get<DocumentUrlResponse>(`/admin/documents/${d.id}/url`);
      if (tab) tab.location.href = url;
      else window.location.assign(url);
    } catch (e) {
      tab?.close();
      setError(errorText(e));
    }
  };
  return (
    <li className="flex flex-col gap-3 rounded-lg border border-line bg-surface-raised p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-body-strong">{t(`admin.booking.docType.${d.type}`)}</p>
          <p className="text-body">{d.clientName}{d.clientPhone ? ` · ${d.clientPhone}` : ''}</p>
          <p className="text-caption text-ink-muted tabular">
            {f.dateTime(d.createdAt)}
            {d.clientLicense ? ` · ${t('admin.documents.license', { category: t(`admin.documents.licenseName.${d.clientLicense}`) })}` : ''}
          </p>
          {d.rejectReason && <p className="mt-1 text-caption text-danger">{d.rejectReason}</p>}
          {d.verifiedBy && <p className="mt-1 text-caption text-ink-muted">{d.verifiedBy}</p>}
        </div>
        <Badge tone={TONE[d.status]}>{t(`admin.booking.docStatus.${d.status}`)}</Badge>
      </div>
      {(error || save.error) && <Alert>{error ?? save.error}</Alert>}
      {rejecting && (
        <Field label={t('admin.documents.reason')} htmlFor={`reason-${d.id}`} hint={t('admin.documents.reasonHint')}>
          <input id={`reason-${d.id}`} className={inputClass} value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} />
        </Field>
      )}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" icon={ExternalLink} onClick={() => void open()}>{t('admin.booking.openDocument')}</Button>
        {rejecting ? (
          <>
            <Button size="sm" variant="inverse" loading={save.isLoading} onClick={() => save.mutate({ status: 'REJECTED', rejectReason: reason.trim() || undefined })}>{t('admin.documents.rejectSend')}</Button>
            <Button size="sm" variant="ghost" onClick={() => setRejecting(false)}>{t('admin.common.close')}</Button>
          </>
        ) : (
          <>
            {d.status !== 'VERIFIED' && <Button size="sm" variant="inverse" loading={save.isLoading} onClick={() => save.mutate({ status: 'VERIFIED' })}>{t('admin.documents.verify')}</Button>}
            {d.status !== 'REJECTED' && <Button size="sm" variant="ghost" onClick={() => setRejecting(true)}>{t('admin.documents.reject')}</Button>}
          </>
        )}
      </div>
    </li>
  );
}

/** Проверка документов клиентов: только администратор. Менеджер при выдаче видит результат и сверяет оригиналы. */
export default function Documents() {
  const { t } = useTranslation();
  const [status, setStatus] = useState<(typeof FILTERS)[number]>('UPLOADED');
  const [page, setPage] = useState(1);
  const q = useAdminGet<AdminDocumentList>('/admin/documents', { status, page });
  const rows = q.data?.items ?? [];
  const pages = q.data ? Math.max(1, Math.ceil(q.data.total / q.data.pageSize)) : 1;
  return (
    <>
      <PageHeader title={t('admin.nav.documents')} meta={t('admin.documents.meta', { count: q.data?.waiting ?? 0 })} />
      <ChipGroup label={t('admin.nav.documents')} className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((s) => (
          <Chip key={s} variant="option" selected={status === s} onClick={() => { setStatus(s); setPage(1); }}>
            {t(`admin.booking.docStatus.${s}`)}
          </Chip>
        ))}
      </ChipGroup>
      <LoadGate isLoading={q.isLoading} isError={q.isError} onRetry={() => void q.refetch()}>
        {rows.length === 0 ? (
          <EmptyState icon={FileCheck} title={t('admin.documents.empty')} className="py-12" />
        ) : (
          <ul className="grid gap-3 lg:grid-cols-2">{rows.map((d) => <DocumentCard key={d.id} d={d} />)}</ul>
        )}
      </LoadGate>
      {pages > 1 && (
        <nav className="mt-4 flex items-center justify-between gap-3" aria-label={t('admin.common.page', { page, pages })}>
          <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>{t('admin.common.prev')}</Button>
          <span className="text-caption text-ink-muted tabular">{t('admin.common.page', { page, pages })}</span>
          <Button variant="secondary" size="sm" disabled={page >= pages} onClick={() => setPage(page + 1)}>{t('admin.common.next')}</Button>
        </nav>
      )}
    </>
  );
}
