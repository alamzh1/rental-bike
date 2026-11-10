import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BookUser, Camera, Check, CreditCard, FileWarning, Globe, Loader2, type LucideIcon } from 'lucide-react';
import { Badge, Button, Icon, Skeleton, cn } from '@rental/ui';
import {
  DOCUMENT_CONTENT_TYPES,
  DOCUMENT_MAX_BYTES,
  missingDocuments,
  type CreateDocumentRequest,
  type CreateDocumentResponse,
  type DocumentContentType,
  type DocumentDto,
  type DocumentListResponse,
  type DocumentType,
} from '@rental/shared';
import { useApp, useHaptic } from '@/app/context';
import { ApiRequestError } from '@/app/session/api';
import { errorCode, errorKey } from '../checkout/errors';

const ICONS: Record<DocumentType, LucideIcon> = { PASSPORT: BookUser, LICENSE: CreditCard, IDP: Globe };

const isAllowed = (type: string): type is DocumentContentType => (DOCUMENT_CONTENT_TYPES as readonly string[]).includes(type);

/** Загруженные документы и каких не хватает для брони. Пока список не пришёл, бронировать нельзя: сервер всё равно проверит. */
export function useDocumentsState() {
  const { api, user } = useApp();
  const list = useQuery({ queryKey: ['documents'], queryFn: () => api.request<DocumentListResponse>('/documents') });
  const missing = missingDocuments(list.data?.items ?? [], user.licenseCategory);
  return { list, missing, ready: !!list.data && missing.length === 0 };
}

/** Фото документов клиента: крупные карточки на весь экран, состояние каждого документа и сколько осталось до брони. */
export function DocumentSlots() {
  const { t } = useTranslation();
  const haptic = useHaptic();
  const qc = useQueryClient();
  const { api, user } = useApp();
  const { list, missing, ready } = useDocumentsState();
  const [consent, setConsent] = useState(false);
  const [askConsent, setAskConsent] = useState(false);
  const [pending, setPending] = useState<DocumentType | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const inputs = useRef<Partial<Record<DocumentType, HTMLInputElement | null>>>({});

  const upload = useMutation({
    mutationFn: async ({ type, file }: { type: DocumentType; file: File }) => {
      if (!isAllowed(file.type)) throw new ApiRequestError(400, 'VALIDATION');
      if (file.size > DOCUMENT_MAX_BYTES) throw new ApiRequestError(400, 'FILE_TOO_LARGE');
      const body: CreateDocumentRequest = {
        type,
        contentType: file.type,
        ...(consent || !list.data?.consentGiven ? { consent: true } : {}),
        ...(type !== 'PASSPORT' && user.licenseCategory ? { licenseCategory: user.licenseCategory } : {}),
      };
      const slot = await api.request<CreateDocumentResponse>('/documents', { method: 'POST', json: body });
      const put = await fetch(slot.uploadUrl, { method: slot.method, headers: slot.headers, body: file });
      if (!put.ok) {
        // Запись без файла показала бы менеджеру пустой документ
        await api.request(`/documents/${slot.documentId}`, { method: 'DELETE' }).catch(() => undefined);
        throw new ApiRequestError(put.status, 'UNKNOWN');
      }
    },
    onMutate: ({ type }) => {
      setPending(type);
      setFailure(null);
    },
    onSuccess: async () => {
      haptic.notification('success');
      await qc.invalidateQueries({ queryKey: ['documents'] });
    },
    onError: (e) => {
      haptic.notification('error');
      setFailure(t(errorKey(errorCode(e))));
    },
    onSettled: () => setPending(null),
  });

  if (list.isError) {
    return (
      <div className="flex items-center gap-3 rounded-lg bg-danger-soft p-4 text-danger">
        <Icon icon={FileWarning} size={24} />
        <p className="m-0 min-w-0 flex-1 text-body">{t('profile.documents.error')}</p>
        <Button size="sm" variant="secondary" onClick={() => void list.refetch()}>{t('common.actions.retry')}</Button>
      </div>
    );
  }
  if (!list.data) {
    return (
      <div aria-busy="true" className="flex flex-col gap-3">
        {[0, 1].map((i) => <Skeleton key={i} className="h-20 w-full" />)}
      </div>
    );
  }

  const needConsent = !list.data.consentGiven;
  const latest = (type: DocumentType): DocumentDto | undefined => list.data?.items.filter((d) => d.type === type).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  const licenseNeeded = user.licenseCategory !== 'NONE';
  const types: DocumentType[] = licenseNeeded ? ['PASSPORT', 'LICENSE', 'IDP'] : ['PASSPORT'];
  const total = licenseNeeded ? 2 : 1;
  const done = total - missing.length;

  const pick = (type: DocumentType) => {
    if (needConsent && !consent) {
      haptic.notification('error');
      setAskConsent(true);
      return;
    }
    inputs.current[type]?.click();
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2" role="status">
        <div className="flex items-center justify-between gap-3">
          <span className={cn('text-body-strong', ready && 'text-success')}>{ready ? t('profile.documents.slot.ready') : t('profile.documents.slot.progress', { done, total })}</span>
        </div>
        <div aria-hidden className="h-2 overflow-hidden rounded-full bg-skeleton">
          <div className={cn('h-full rounded-full transition-[width] duration-base ease-out', ready ? 'bg-success' : 'bg-accent')} style={{ width: `${(done / total) * 100}%` }} />
        </div>
      </div>

      {needConsent && (
        <label className="flex min-h-control-md cursor-pointer items-start gap-3">
          <input type="checkbox" checked={consent} onChange={(e) => { setConsent(e.target.checked); setAskConsent(false); }} className="mt-0.5 h-6 w-6 shrink-0 accent-[var(--accent)]" />
          <span className={cn('text-body', askConsent && 'text-danger')}>{t('profile.documents.consent')}</span>
        </label>
      )}
      {askConsent && <p role="alert" className="m-0 text-caption text-danger">{t('profile.documents.consentFirst')}</p>}

      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {types.map((type) => {
          const doc = latest(type);
          const busy = pending === type;
          const rejected = doc?.status === 'REJECTED';
          const accepted = !!doc && !rejected;
          const optional = type === 'IDP';
          const coveredByIdp = type === 'LICENSE' && !accepted && !missing.includes('LICENSE');
          const open = !accepted && !coveredByIdp && !optional;
          return (
            <li key={type}>
              <input
                ref={(el) => { inputs.current[type] = el; }}
                type="file"
                accept={DOCUMENT_CONTENT_TYPES.join(',')}
                className="sr-only"
                tabIndex={-1}
                aria-label={t(`profile.documents.type.${type}`)}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = '';
                  if (file) upload.mutate({ type, file });
                }}
              />
              <button
                type="button"
                disabled={upload.isPending}
                onClick={() => pick(type)}
                className={cn(
                  'flex min-h-20 w-full items-center gap-3 rounded-lg p-3 text-left transition-colors duration-fast disabled:opacity-70',
                  rejected ? 'border-2 border-danger bg-danger-soft' : open ? 'border-2 border-dashed border-accent bg-accent-soft' : accepted ? 'border border-line bg-success-soft' : 'border border-dashed border-line-strong',
                )}
              >
                <span className={cn('grid h-12 w-12 shrink-0 place-items-center rounded-full', accepted ? 'bg-success text-on-accent' : rejected ? 'bg-danger text-on-accent' : open ? 'bg-accent text-on-accent' : 'bg-surface text-ink-muted')}>
                  <Icon icon={busy ? Loader2 : accepted ? Check : ICONS[type]} size={24} className={busy ? 'animate-spin' : undefined} />
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="text-body-strong text-ink">{t(`profile.documents.type.${type}`)}</span>
                    {!accepted && !coveredByIdp && <Badge plain tone={rejected ? 'danger' : optional ? 'neutral' : 'warning'}>{t(optional ? 'profile.documents.slot.optional' : 'profile.documents.slot.required')}</Badge>}
                  </span>
                  <span className={cn('text-caption', rejected ? 'text-danger' : 'text-ink-muted')}>
                    {accepted ? t(`profile.documents.docStatus.${doc.status}`) : rejected ? t('profile.documents.slot.rejected') : coveredByIdp ? t('profile.documents.slot.viaIdp') : t(`profile.documents.slot.hint.${type}`)}
                  </span>
                  {open && !rejected && <span className="text-caption font-bold text-accent-text">{t('profile.documents.slot.upload')}</span>}
                  {accepted && <span className="text-caption font-bold text-ink-muted">{t('profile.documents.replace')}</span>}
                </span>
                {!accepted && <Icon icon={Camera} size={24} className={cn('shrink-0', open ? 'text-accent-text' : rejected ? 'text-danger' : 'text-ink-muted')} />}
              </button>
            </li>
          );
        })}
      </ul>
      {failure && <p role="alert" className="m-0 text-caption text-danger">{failure}</p>}
      <p className="m-0 text-caption text-ink-muted">{t('profile.documents.retention')}</p>
    </div>
  );
}
