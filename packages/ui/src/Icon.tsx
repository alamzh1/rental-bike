import type { LucideIcon } from 'lucide-react';
import { cn } from './cn';

export type IconSize = 16 | 20 | 24;

export interface IconProps {
  icon: LucideIcon;
  size?: IconSize;
  /** Закрашенная иконка — только звезда рейтинга и сердце избранного. */
  filled?: boolean;
  /** Подпись для иконки без текста рядом; без неё иконка скрыта от скринридера. */
  label?: string;
  className?: string;
}

/** Иконка Lucide: 24×24, штрих 2px, скруглённые концы, цвет от текста. */
export function Icon({ icon: Glyph, size = 24, filled = false, label, className }: IconProps) {
  return (
    <Glyph
      width={size}
      height={size}
      strokeWidth={2}
      absoluteStrokeWidth={size !== 24}
      fill={filled ? 'currentColor' : 'none'}
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? 'img' : undefined}
      focusable={false}
      className={cn('shrink-0', className)}
    />
  );
}
