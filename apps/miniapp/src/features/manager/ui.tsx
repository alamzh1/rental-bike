import { useId, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from 'react';
import { useTranslation } from 'react-i18next';
import { formatDate, formatPrice, formatTime } from '@rental/i18n';
import type { Lang } from '@rental/shared';
import { cn } from '@rental/ui';
import { ApiRequestError } from '@/app/session/api';
import { useManagerTimezone } from './api';
import { errorKey } from '../checkout/errors';
import { FUEL_STEPS } from './logic';

// Мелкие части экранов менеджера: поля, секции, форматирование, текст ошибки.

export function useFormat() {
  const { i18n } = useTranslation();
  const lang = (i18n.language || 'en') as Lang;
  const tz = useManagerTimezone();
  return {
    money: (v: number) => formatPrice(v, lang),
    time: (iso: string) => formatTime(new Date(iso), lang, tz),
    date: (iso: string) => formatDate(new Date(iso), lang, tz),
    dateTime: (iso: string) => `${formatDate(new Date(iso), lang, tz)} ${formatTime(new Date(iso), lang, tz)}`,
  };
}

export function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 border-t border-line pt-5">
      <div className="flex flex-col gap-1">
        <h2 className="m-0 text-title-2 text-balance">{title}</h2>
        {hint && <p className="m-0 text-body text-ink-muted">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

export const CONTROL = 'w-full rounded-md border border-line-strong bg-bg px-4 text-body text-ink placeholder:text-ink-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent';

export function Field({ label, hint, children, htmlFor }: { label: string; hint?: string; children: ReactNode; htmlFor: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-body-strong">
        {label}
      </label>
      {children}
      {hint && <p className="m-0 text-caption text-ink-muted">{hint}</p>}
    </div>
  );
}

export function TextInput({ label, hint, className, ...rest }: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  const id = useId();
  return (
    <Field label={label} hint={hint} htmlFor={id}>
      <input id={id} className={cn(CONTROL, 'h-control-md tabular', className)} {...rest} />
    </Field>
  );
}

export function TextArea({ label, hint, className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; hint?: string }) {
  const id = useId();
  return (
    <Field label={label} hint={hint} htmlFor={id}>
      <textarea id={id} rows={2} className={cn(CONTROL, 'resize-none py-3', className)} {...rest} />
    </Field>
  );
}

/** Топливо: пять шагов по 25 %. Выбор — inverse, не синий. */
export function FuelPicker({ value, onChange, label }: { value: number | null; onChange: (v: number) => void; label: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-body-strong" id="fuel-label">
        {label}
      </span>
      <div role="group" aria-labelledby="fuel-label" className="grid grid-cols-5 gap-2">
        {FUEL_STEPS.map((step) => (
          <button
            key={step}
            type="button"
            aria-pressed={value === step}
            onClick={() => onChange(step)}
            className={cn(
              'h-control-md rounded-sm border text-body-strong tabular transition-colors duration-fast ease-out',
              value === step ? 'border-inverse bg-inverse text-on-inverse' : 'border-line-strong bg-transparent text-ink',
            )}
          >
            {step}%
          </button>
        ))}
      </div>
    </div>
  );
}

/** Ошибка действия: текст по коду API, под полем, с role=alert. */
export function ErrorLine({ error }: { error: unknown }) {
  const { t } = useTranslation();
  if (!error) return null;
  const code = error instanceof ApiRequestError ? error.code : 'UNKNOWN';
  return (
    <p role="alert" className="m-0 rounded-sm bg-danger-soft px-3 py-2 text-body text-danger">
      {t(errorKey(code))}
    </p>
  );
}

export function Row({ label, value, strong }: { label: string; value: ReactNode; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-body text-ink-muted">{label}</dt>
      <dd className={cn('m-0 text-right tabular', strong ? 'text-price' : 'text-body-strong')}>{value}</dd>
    </div>
  );
}
