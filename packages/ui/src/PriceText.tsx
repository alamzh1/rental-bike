import type { Lang } from '@rental/shared';
import { cn } from './cn';
import { splitPrice, type DisplayCurrency } from './price';

export interface PriceTextProps {
  vnd: number;
  lang: Lang;
  display?: DisplayCurrency;
  /** price-lg — итог в панели цены, price — карточки, body — строки расшифровки. */
  size?: 'price-lg' | 'price' | 'body';
  /** Подпись после суммы: «/день», «за 7 дней». Уже переведённая. */
  suffix?: string;
  /** Пересчёт в строку ниже (панель цены) или в той же строке. */
  approxLayout?: 'inline' | 'below';
  className?: string;
  /** Класс для «≈ …» и суффикса; по умолчанию ink-muted, на тёмной панели — nav-icon. */
  mutedClassName?: string;
}

/** Сумма в донгах (tabular-nums) и пересчёт «≈» вторым цветом. */
export function PriceText({
  vnd,
  lang,
  display,
  size = 'price',
  suffix,
  approxLayout = 'inline',
  className,
  mutedClassName = 'text-ink-muted',
}: PriceTextProps) {
  const { main, approx } = splitPrice(vnd, lang, display);
  const SIZE = { 'price-lg': 'text-price-lg', price: 'text-price', body: 'text-body-strong' } as const;
  return (
    <span className={cn('tabular inline-flex flex-wrap items-baseline gap-x-1', approxLayout === 'below' && 'flex-col gap-0', className)}>
      <span className="inline-flex items-baseline gap-1">
        <span className={SIZE[size]}>{main}</span>
        {suffix && <span className={cn('text-caption', mutedClassName)}>{suffix}</span>}
      </span>
      {approx && <span className={cn('text-caption', mutedClassName)}>{approx}</span>}
    </span>
  );
}
