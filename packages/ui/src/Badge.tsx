import type { ReactNode } from 'react';
import type { BookingStatus } from '@rental/shared';
import { cn } from './cn';

export type BadgeTone = 'warning' | 'accent' | 'success' | 'neutral' | 'danger';

const TONE: Record<BadgeTone, string> = {
  warning: 'bg-warning-soft text-warning',
  accent: 'bg-accent-soft text-accent-text',
  success: 'bg-success-soft text-success',
  neutral: 'bg-surface text-ink-muted',
  danger: 'bg-danger-soft text-danger',
};

const STATUS_TONE: Record<BookingStatus, BadgeTone> = {
  PENDING_PAYMENT: 'warning',
  CONFIRMED: 'accent',
  ISSUED: 'success',
  COMPLETED: 'neutral',
  CANCELLED_BY_CLIENT: 'neutral',
  CANCELLED_BY_SYSTEM: 'neutral',
  PROBLEM: 'danger',
};

/** Цвет бейджа для статуса брони. Текст статуса — всегда словом, через i18n. */
export function bookingStatusTone(status: BookingStatus): BadgeTone {
  return STATUS_TONE[status];
}

export interface BadgeProps {
  tone?: BadgeTone;
  /** Без точки — служебные метки («Нужны права A»). */
  plain?: boolean;
  className?: string;
  children: ReactNode;
}

/** Бейдж: слово плюс цветная точка. Цвет только подкрепляет слово. */
export function Badge({ tone = 'neutral', plain = false, className, children }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex h-6 items-center gap-1.5 whitespace-nowrap rounded-pill px-2.5 text-label',
        TONE[tone],
        className,
      )}
    >
      {!plain && <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}
