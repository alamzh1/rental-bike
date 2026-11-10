import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from './cn';
import { Icon } from './Icon';

export interface ChipProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  /** filter — пилюля 36px (категории, быстрые даты); option — крупный вариант 44px в шторке. */
  variant?: 'filter' | 'option';
  selected?: boolean;
  icon?: LucideIcon;
  children: ReactNode;
}

/** Переключатель-фильтр. Выбор — inverse, не синий: синий оставлен для действия. */
export function Chip({ variant = 'filter', selected = false, icon, className, children, type = 'button', ...rest }: ChipProps) {
  return (
    <button
      type={type}
      aria-pressed={selected}
      className={cn(
        'relative inline-flex flex-none items-center gap-1.5 whitespace-nowrap transition-colors duration-fast ease-out',
        variant === 'filter' &&
          'hit-44 h-control-sm rounded-pill px-4 text-caption font-semibold',
        variant === 'option' && 'h-control-md rounded-sm border px-[18px] text-body font-semibold',
        variant === 'filter' && (selected ? 'bg-inverse text-on-inverse' : 'bg-surface text-ink'),
        variant === 'option' &&
          (selected ? 'border-inverse bg-inverse text-on-inverse' : 'border-line-strong bg-transparent text-ink'),
        className,
      )}
      {...rest}
    >
      {icon && <Icon icon={icon} size={16} />}
      {children}
    </button>
  );
}

export interface ChipGroupProps extends HTMLAttributes<HTMLDivElement> {
  /** Подпись группы для скринридера. */
  label: string;
  /** Ряд прокручивается вбок, выходя под боковые поля экрана. */
  scroll?: boolean;
}

export function ChipGroup({ label, scroll, className, children, ...rest }: ChipGroupProps) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        'flex gap-2',
        scroll ? 'no-scrollbar -mx-4 flex-nowrap overflow-x-auto px-4 py-1' : 'flex-wrap',
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}
