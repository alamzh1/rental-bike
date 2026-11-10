import { useEffect, useState, type CSSProperties } from 'react';
import { cn } from './cn';

export interface SkeletonProps {
  className?: string;
  style?: CSSProperties;
  /** Форма: block — плитка radius-sm, text — строка, circle — аватар/иконка. */
  shape?: 'block' | 'text' | 'circle';
}

/** Заглушка по форме будущего контента. Контейнеру ставь aria-busy="true". */
export function Skeleton({ className, style, shape = 'block' }: SkeletonProps) {
  return (
    <div
      aria-hidden
      style={style}
      className={cn(
        'ui-skeleton',
        shape === 'block' && 'rounded-sm',
        shape === 'text' && 'h-3.5 rounded-xs',
        shape === 'circle' && 'rounded-full',
        className,
      )}
    />
  );
}

/** true через delay мс: если ответ пришёл быстрее 200 мс, скелетон не мелькает. */
export function useDelayedFlag(active: boolean, delay = 200): boolean {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (!active) {
      setShown(false);
      return;
    }
    const id = window.setTimeout(() => setShown(true), delay);
    return () => window.clearTimeout(id);
  }, [active, delay]);
  return active && shown;
}
