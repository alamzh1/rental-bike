import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from './cn';
import { Icon } from './Icon';

export type ButtonVariant = 'primary' | 'inverse' | 'secondary' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  icon?: LucideIcon;
  iconPosition?: 'start' | 'end';
  /** Действие выполняется: кнопка неактивна, aria-busy. Текст оставь глаголом процесса. */
  loading?: boolean;
  children: ReactNode;
}

const VARIANT: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-on-accent',
  inverse: 'bg-inverse text-on-inverse',
  secondary: 'bg-surface text-ink',
  ghost: 'bg-transparent text-accent-text px-2',
};

const SIZE: Record<ButtonSize, string> = {
  sm: 'hit-44 h-control-sm px-[14px] rounded-sm text-caption font-bold',
  md: 'h-control-md px-5 rounded-md text-button',
  lg: 'h-control-lg px-6 rounded-md text-button',
};

/** Кнопка действия. Одна primary на экран; при показанном Telegram MainButton своя не дублируется. */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', block, icon, iconPosition = 'end', loading, disabled, className, children, type = 'button', ...rest },
  ref,
) {
  const glyph = icon ? <Icon icon={icon} size={size === 'sm' ? 16 : 20} /> : null;
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        'relative inline-flex select-none items-center justify-center gap-2 whitespace-nowrap',
        'transition-[transform,filter,opacity] duration-fast ease-out active:scale-[0.98] active:brightness-[0.92]',
        'disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100 disabled:active:brightness-100',
        VARIANT[variant],
        SIZE[size],
        variant === 'ghost' && size !== 'sm' && 'px-2',
        block && 'flex w-full',
        loading && 'cursor-progress',
        className,
      )}
      {...rest}
    >
      {iconPosition === 'start' && glyph}
      <span className={cn(loading && 'opacity-70')}>{children}</span>
      {iconPosition === 'end' && glyph}
    </button>
  );
});
