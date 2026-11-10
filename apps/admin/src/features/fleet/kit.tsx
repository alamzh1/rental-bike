import { useCallback, useId, useState, type ChangeEvent, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { CircleAlert, ImageUp } from 'lucide-react';
import { ADMIN_REQUEST_HEADER, type I18nText, type Lang } from '@rental/shared';
import { Badge, cn, EmptyState, Icon, Skeleton } from '@rental/ui';
import { AdminApiError, sessionHeaders } from '@/app/api';
import { API_BASE } from '@/app/env';
import { api } from '@/app/providers';
import { inputClass, useErrorText, useToast } from '@/app/ui';

// Общие детали разделов таска 11 (парк, цены, точки, тексты, платежи, настройки, баннер): запросы, поля на 3 языках,
// метка «ДЕМО», загрузка файлов. Общие для Mini App компоненты — только в packages/ui.

export const LANG_ORDER: Lang[] = ['ru', 'en', 'vi'];
export const textareaClass = cn(inputClass, 'h-auto min-h-[88px] py-2 leading-[22px]');

type Query = Record<string, string | number | undefined | null>;

/** GET /api<path> с кэшем TanStack Query (ключ — путь и параметры). */
export function useAdminGet<T>(path: string, query?: Query, enabled = true) {
  return useQuery<T, AdminApiError>({ queryKey: ['admin', path, query ?? {}], queryFn: () => api.get<T>(path, query), enabled });
}

/** Текст ошибки: сначала коды разделов таска 11 (admin-fleet.errors.*), затем общий перевод админки. */
export function useFleetErrorText() {
  const { t, i18n } = useTranslation();
  const base = useErrorText();
  return useCallback(
    (e: unknown) => {
      const code = e instanceof AdminApiError ? e.code : '';
      return code && i18n.exists(`admin-fleet.errors.${code}`) ? t(`admin-fleet.errors.${code}`) : base(e);
    },
    [t, i18n, base],
  );
}

/** Изменение с подтверждением и переводом ошибки; после успеха — обновить данные раздела. */
export function useAdminSave<TVars, TRes = unknown>(fn: (v: TVars) => Promise<TRes>, opts: { success?: string; invalidate?: string[] } = {}) {
  const client = useQueryClient();
  const toast = useToast();
  const errorText = useFleetErrorText();
  const [error, setError] = useState<string | null>(null);
  const m = useMutation<TRes, unknown, TVars>({
    mutationFn: fn,
    onMutate: () => setError(null),
    onSuccess: async () => {
      if (opts.success) toast('success', opts.success);
      await Promise.all((opts.invalidate ?? []).map((p) => client.invalidateQueries({ queryKey: ['admin', p] })));
    },
    onError: (e) => setError(errorText(e)),
  });
  return { ...m, error, clearError: () => setError(null) };
}

/** Загрузка файла телом запроса (Content-Type — тип файла): фото модели, логотип, баннер. */
export async function uploadFile<T>(path: string, file: File): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, { method: 'POST', credentials: 'include', headers: { ...sessionHeaders(), [ADMIN_REQUEST_HEADER]: '1', 'content-type': file.type || 'application/octet-stream', accept: 'application/json' }, body: file });
  } catch {
    throw new AdminApiError(0, 'NETWORK');
  }
  const json = (await res.json().catch(() => null)) as { code?: string } | null;
  if (!res.ok) throw new AdminApiError(res.status, json?.code ?? 'UNKNOWN');
  return json as T;
}

/** Загрузка в приватное хранилище по подписанной ссылке (документы байка). */
export async function putSigned(url: string, headers: Record<string, string>, file: File): Promise<void> {
  const res = await fetch(url, { method: 'PUT', headers, body: file }).catch(() => null);
  if (!res || !res.ok) throw new AdminApiError(res?.status ?? 0, res?.status === 413 ? 'FILE_TOO_LARGE' : 'UPLOAD_FAILED');
}

export function DemoTag({ show = true }: { show?: boolean }) {
  const { t } = useTranslation();
  if (!show) return null;
  return (
    <Badge tone="warning" plain>
      {t('admin.demo.tag')}
    </Badge>
  );
}

/** Ошибка загрузки или скелетон раздела. */
export function LoadGate({ isLoading, isError, onRetry, rows = 4, children }: { isLoading: boolean; isError: boolean; onRetry: () => void; rows?: number; children: ReactNode }) {
  const { t } = useTranslation();
  if (isError) return <EmptyState icon={CircleAlert} tone="danger" title={t('admin.common.errorTitle')} action={{ label: t('admin.common.retry'), onClick: onRetry }} className="py-12" />;
  if (isLoading)
    return (
      <div aria-busy="true" className="flex flex-col gap-2">
        {Array.from({ length: rows }, (_, i) => (
          <Skeleton key={i} className="h-12" />
        ))}
      </div>
    );
  return <>{children}</>;
}

/** Текст на трёх языках: EN обязателен (фолбэк в Mini App), RU и VI — по желанию. */
export function I18nTextField({
  label,
  value,
  onChange,
  multiline = false,
  rows = 3,
  maxLength,
  hint,
}: {
  label: string;
  value: Partial<I18nText> | null | undefined;
  onChange: (v: Partial<I18nText>) => void;
  multiline?: boolean;
  rows?: number;
  maxLength?: number;
  hint?: string;
}) {
  const { t } = useTranslation();
  const id = useId();
  const v = value ?? {};
  return (
    <fieldset className="flex min-w-0 flex-col gap-2">
      <legend className="mb-1.5 text-caption font-bold text-ink">{label}</legend>
      {LANG_ORDER.map((lang) => {
        const fid = `${id}-${lang}`;
        const missing = lang === 'en' && !v.en?.trim();
        return (
          <div key={lang} className={cn('grid gap-2', multiline ? 'grid-cols-1' : 'grid-cols-[44px_minmax(0,1fr)] items-center')}>
            <label htmlFor={fid} className="text-label uppercase text-ink-muted">
              {lang}
              {lang === 'en' && <span className="ml-1 normal-case">{t('admin-fleet.common.required')}</span>}
            </label>
            {multiline ? (
              <textarea id={fid} rows={rows} maxLength={maxLength} value={v[lang] ?? ''} onChange={(e) => onChange({ ...v, [lang]: e.target.value })} className={textareaClass} aria-invalid={missing || undefined} />
            ) : (
              <input id={fid} value={v[lang] ?? ''} maxLength={maxLength} onChange={(e) => onChange({ ...v, [lang]: e.target.value })} className={inputClass} aria-invalid={missing || undefined} />
            )}
          </div>
        );
      })}
      {hint && <span className="text-caption text-ink-muted">{hint}</span>}
    </fieldset>
  );
}

/** Число в поле ввода: пусто → null. */
export function NumberInput({ id, value, onChange, min, max, step, suffix, invalid }: { id: string; value: number | null | undefined; onChange: (v: number | null) => void; min?: number; max?: number; step?: number | 'any'; suffix?: string; invalid?: boolean }) {
  return (
    <div className="relative">
      <input
        id={id}
        type="number"
        inputMode="decimal"
        value={value ?? ''}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
        className={cn(inputClass, 'tabular', suffix && (suffix.length === 1 ? 'pr-8' : 'pr-14'))}
        aria-invalid={invalid || undefined}
      />
      {suffix && <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-caption text-ink-muted">{suffix}</span>}
    </div>
  );
}

/** Кнопка выбора изображения: файл уходит сразу, кнопка показывает загрузку. */
export function ImagePicker({ label, onPick, loading, accept = 'image/jpeg,image/png,image/webp,image/avif,image/heic' }: { label: string; onPick: (f: File) => void; loading?: boolean; accept?: string }) {
  const id = useId();
  const pick = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0];
      e.target.value = '';
      if (f) onPick(f);
    },
    [onPick],
  );
  return (
    <label htmlFor={id} className={cn('relative inline-flex h-control-md cursor-pointer items-center gap-2 rounded-md bg-surface px-5 text-button text-ink transition-colors duration-fast ease-out hover:bg-line [&:has(:focus-visible)]:outline [&:has(:focus-visible)]:outline-2 [&:has(:focus-visible)]:outline-offset-2 [&:has(:focus-visible)]:outline-focus-ring', loading && 'pointer-events-none opacity-60')} aria-busy={loading || undefined}>
      <Icon icon={ImageUp} size={20} />
      {label}
      <input id={id} type="file" accept={accept} className="sr-only" onChange={pick} disabled={loading} />
    </label>
  );
}

/** Строка «подпись — значение» в карточке на телефоне. */
export function Meta({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex justify-between gap-3 text-caption">
      <span className="text-ink-muted">{label}</span>
      <span className="text-right text-ink tabular">{children}</span>
    </div>
  );
}

