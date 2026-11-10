import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@rental/ui';

export interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: string;
  error?: string | null;
  trailing?: ReactNode;
}

/** Текстовое поле: рамка line-strong, подпись сверху, ошибка и подсказка текстом под полем. */
export const Field = forwardRef<HTMLInputElement, FieldProps>(function Field({ label, hint, error, trailing, className, id, ...rest }, ref) {
  const auto = useId();
  const inputId = id ?? auto;
  const noteId = `${inputId}-note`;
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <label htmlFor={inputId} className="text-caption font-semibold text-ink-muted">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <input
          ref={ref}
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={error || hint ? noteId : undefined}
          className={cn(
            'h-control-md min-w-0 flex-1 rounded-md border bg-bg px-4 text-body text-ink placeholder:text-ink-muted',
            error ? 'border-danger' : 'border-line-strong',
          )}
          {...rest}
        />
        {trailing}
      </div>
      {(error || hint) && (
        <p id={noteId} role={error ? 'alert' : undefined} className={cn('m-0 text-caption', error ? 'text-danger' : 'text-ink-muted')}>
          {error ?? hint}
        </p>
      )}
    </div>
  );
});
