import { forwardRef, type ButtonHTMLAttributes } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from './cn';
import { Icon } from './Icon';

export type IconButtonVariant = 'default' | 'inverse' | 'surface' | 'float';

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label' | 'children'> {
  icon: LucideIcon;
  /** Обязательная подпись на языке интерфейса. */
  label: string;
  variant?: IconButtonVariant;
  /** Переключатель (сердце избранного): закрашивает иконку цветом favorite. */
  pressed?: boolean;
}

const VARIANT: Record<IconButtonVariant, string> = {
  default: 'h-control-md w-control-md border border-line bg-bg text-ink',
  inverse: 'h-control-md w-control-md border border-inverse bg-inverse text-on-inverse',
  surface: 'h-control-md w-control-md border border-surface bg-surface text-ink',
  float: 'hit-44 h-8 w-8 border border-transparent bg-surface-raised text-ink',
};

/** Круглая кнопка с одной иконкой. */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { icon, label, variant = 'default', pressed, className, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      aria-pressed={pressed}
      className={cn(
        'relative inline-grid shrink-0 place-items-center rounded-pill p-0',
        'transition-transform duration-fast ease-out active:scale-95 disabled:opacity-40',
        VARIANT[variant],
        pressed && 'text-favorite',
        className,
      )}
      {...rest}
    >
      <Icon icon={icon} size={variant === 'float' ? 20 : 24} filled={pressed} />
    </button>
  );
});
