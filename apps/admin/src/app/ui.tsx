import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { CircleAlert, CircleCheck, Phone, X } from 'lucide-react';
import { formatDate, formatPrice, formatTime } from '@rental/i18n';
import type { AdminMe, Lang } from '@rental/shared';
import { cn, Icon } from '@rental/ui';
import { AdminApiError } from './api';

// Локальные компоненты админки (общие для разделов таска 10 и 11). Общие для Mini App — только в packages/ui.

export const MeContext = createContext<AdminMe | null>(null);

export function useMe(): AdminMe {
  const me = useContext(MeContext);
  if (!me) throw new Error('useMe outside of an authenticated layout');
  return me;
}

/** Деньги и даты в часовом поясе точки и языке интерфейса. */
export function useFormat() {
  const { i18n } = useTranslation();
  const me = useContext(MeContext);
  const lang = (i18n.language as Lang) || 'ru';
  const tz = me?.timezone ?? 'Asia/Ho_Chi_Minh';
  return useMemo(
    () => ({
      lang,
      tz,
      money: (vnd: number) => formatPrice(vnd, lang),
      date: (iso: string | Date) => formatDate(new Date(iso), lang, tz),
      time: (iso: string | Date) => formatTime(new Date(iso), lang, tz),
      dateTime: (iso: string | Date) => `${formatDate(new Date(iso), lang, tz)}, ${formatTime(new Date(iso), lang, tz)}`,
    }),
    [lang, tz],
  );
}

/** Текст ошибки API: сначала admin.errors.<code>, затем общий errors.<code>. */
export function useErrorText() {
  const { t, i18n } = useTranslation();
  return useCallback(
    (e: unknown): string => {
      const code = e instanceof AdminApiError ? e.code : 'UNKNOWN';
      if (code === 'BIKE_TAKEN' && e instanceof AdminApiError) return e.conflict ? t('admin.errors.BIKE_TAKEN', { code: e.conflict.code }) : t('admin.errors.BIKE_TAKEN_ANY');
      if (i18n.exists(`admin.errors.${code}`)) return t(`admin.errors.${code}`);
      if (i18n.exists(`errors.${code}`)) return t(`errors.${code}`);
      return t('errors.UNKNOWN');
    },
    [t, i18n],
  );
}

export function PageHeader({ title, meta, actions }: { title: string; meta?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
      <div className="min-w-0">
        <h1 className="text-title-1 text-balance">{title}</h1>
        {meta && <p className="mt-1 text-caption text-ink-muted">{meta}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

/** Блок страницы: поверхность surface-raised с рамкой line. Вложенных блоков нет. */
export function Panel({ title, actions, children, className, bodyClassName }: { title?: string; actions?: ReactNode; children: ReactNode; className?: string; bodyClassName?: string }) {
  return (
    <section className={cn('rounded-lg border border-line bg-surface-raised', className)}>
      {(title || actions) && (
        <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
          {title && <h2 className="text-headline">{title}</h2>}
          {actions}
        </div>
      )}
      <div className={cn('p-4', bodyClassName)}>{children}</div>
    </section>
  );
}

export function Field({ label, hint, children, htmlFor }: { label: string; hint?: string; children: ReactNode; htmlFor: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-caption font-bold text-ink">
        {label}
      </label>
      {children}
      {hint && <span className="text-caption text-ink-muted">{hint}</span>}
    </div>
  );
}

export const inputClass =
  'h-control-md w-full min-w-0 rounded-sm border border-line-strong bg-bg px-3 text-body text-ink placeholder:text-ink-muted transition-colors duration-fast ease-out hover:border-ink-muted disabled:opacity-40';

export function Alert({ tone = 'danger', children, onClose, closeLabel }: { tone?: 'danger' | 'success' | 'warning'; children: ReactNode; onClose?: () => void; closeLabel?: string }) {
  const tones = { danger: 'bg-danger-soft text-danger', success: 'bg-success-soft text-success', warning: 'bg-warning-soft text-warning' };
  return (
    <div role={tone === 'danger' ? 'alert' : 'status'} className={cn('flex items-start gap-2 rounded-sm px-3 py-2.5 text-body', tones[tone])}>
      <Icon icon={tone === 'success' ? CircleCheck : CircleAlert} size={20} />
      <div className="min-w-0 flex-1">{children}</div>
      {onClose && (
        <button type="button" onClick={onClose} className="hit-44 relative -m-1 rounded-pill p-1" aria-label={closeLabel}>
          <Icon icon={X} size={16} />
        </button>
      )}
    </div>
  );
}

type Toast = { id: number; tone: 'success' | 'danger'; text: string };
const ToastContext = createContext<(tone: Toast['tone'], text: string) => void>(() => undefined);

export function useToast() {
  return useContext(ToastContext);
}

/** Короткие подтверждения действий внизу экрана (4 с), объявляются скринридеру. */
export function ToastHost({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const push = useCallback((tone: Toast['tone'], text: string) => setItems((l) => [...l.slice(-2), { id: Date.now() + Math.random(), tone, text }]), []);
  useEffect(() => {
    if (!items.length) return;
    const timer = setTimeout(() => setItems((l) => l.slice(1)), 4000);
    return () => clearTimeout(timer);
  }, [items]);
  return (
    <ToastContext.Provider value={push}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+theme(spacing.24))] z-toast flex flex-col items-center gap-2 px-4 lg:bottom-4">
        {items.map((t) => (
          <div key={t.id} className={cn('pointer-events-auto flex max-w-app items-center gap-2 rounded-md bg-inverse px-4 py-3 text-body text-on-inverse shadow-nav animate-fade-in')}>
            <Icon icon={t.tone === 'success' ? CircleCheck : CircleAlert} size={20} />
            {t.text}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

/** Таблица. На телефоне каждая строка становится карточкой «подпись — значение» (.dt-stack в styles.css). */
export function DataTable({ head, children, label }: { head: ReactNode; children: ReactNode; label: string }) {
  const table = useRef<HTMLTableElement>(null);
  // Подписи карточек — из заголовков колонок. Роли возвращают семантику таблицы, которую убирает display: block.
  useLayoutEffect(() => {
    const el = table.current;
    if (!el) return;
    const titles = Array.from(el.querySelectorAll('thead th')).map((th) => {
      th.setAttribute('role', 'columnheader');
      return th.textContent?.trim() ?? '';
    });
    el.querySelectorAll('thead, tbody').forEach((g) => g.setAttribute('role', 'rowgroup'));
    el.querySelectorAll('tr').forEach((tr) => tr.setAttribute('role', 'row'));
    el.querySelectorAll('tbody tr').forEach((tr) => {
      Array.from(tr.children).forEach((td, i) => {
        td.setAttribute('role', 'cell');
        td.setAttribute('data-label', titles[i] ?? '');
      });
    });
  });
  return (
    <div className="-mx-4 overflow-x-auto px-4">
      <table ref={table} role="table" className="dt-stack w-full border-collapse text-body" aria-label={label}>
        <thead>
          <tr className="border-b border-line text-caption text-ink-muted">{head}</tr>
        </thead>
        <tbody className="[&>tr]:border-b [&>tr]:border-line [&>tr:last-child]:border-0">{children}</tbody>
      </table>
    </div>
  );
}

/** Позвонить клиенту одним касанием: круглая кнопка 44 px для списков на телефоне. */
export function CallLink({ phone, className }: { phone: string; className?: string }) {
  const { t } = useTranslation();
  return (
    <a href={`tel:${phone}`} aria-label={t('admin-ops.call', { phone })} onClick={(e) => e.stopPropagation()} className={cn('grid h-control-md w-control-md flex-none place-items-center rounded-full bg-accent-soft text-accent-text', className)}>
      <Icon icon={Phone} size={20} />
    </a>
  );
}

export const th = 'whitespace-nowrap px-3 py-2 first:pl-0 last:pr-0 font-bold';
export const td = 'px-3 py-3 align-top first:pl-0 last:pr-0';
