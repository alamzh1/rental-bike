import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from './cn';
import { IconButton } from './IconButton';

export interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Подпись кнопки закрытия на языке интерфейса. */
  closeLabel: string;
  children: ReactNode;
  /** Низ шторки: кнопка применения. Стоит над нижней safe area. */
  footer?: ReactNode;
  className?: string;
}

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

/** Нижняя шторка: фильтры, выбор опций. Скрим закрывает, Escape закрывает, фокус остаётся внутри. */
export function Sheet({ open, onClose, title, closeLabel, children, footer, className }: SheetProps) {
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const node = panel.current;
    node?.querySelector<HTMLElement>(FOCUSABLE)?.focus();
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current();
      if (e.key !== 'Tab' || !node) return;
      const items = [...node.querySelectorAll<HTMLElement>(FOCUSABLE)];
      const first = items[0];
      const last = items[items.length - 1];
      if (!first || !last) return;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, [open]);

  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-sheet flex items-end justify-center">
      <div aria-hidden className="absolute inset-0 animate-fade-in bg-scrim" onClick={onClose} />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn(
          'relative flex max-h-[88dvh] w-full max-w-app animate-sheet-in flex-col rounded-t-xl bg-surface-raised shadow-sheet',
          className,
        )}
      >
        <div aria-hidden className="mx-auto mt-2 h-1 w-9 rounded-xs bg-line-strong" />
        <div className="flex items-center justify-between gap-3 px-4 pb-2 pt-3">
          <h2 id={titleId} className="m-0 text-title-2">
            {title}
          </h2>
          <IconButton icon={X} label={closeLabel} variant="surface" onClick={onClose} />
        </div>
        <div className="flex-1 overflow-y-auto overscroll-contain px-4 pb-4">{children}</div>
        {footer && (
          <div className="border-t border-line px-4 pt-3 pb-[calc(var(--safe-bottom)+theme(spacing.4))]">{footer}</div>
        )}
      </div>
    </div>,
    document.body,
  );
}
