import type { LucideIcon } from 'lucide-react';
import { cn } from './cn';
import { Button } from './Button';
import { Icon } from './Icon';

export interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  /** Одна строка: что сделать, а не что пошло не так. */
  text?: string;
  action?: { label: string; onClick: () => void };
  /** danger — ошибка загрузки с кнопкой «Повторить». */
  tone?: 'default' | 'danger';
  className?: string;
}

/** Пустой экран или ошибка: иконка в круге, заголовок, пояснение, одна кнопка. */
export function EmptyState({ icon, title, text, action, tone = 'default', className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center gap-2 px-4 py-8 text-center', className)}>
      <div
        className={cn(
          'mb-2 grid h-18 w-18 place-items-center rounded-full',
          tone === 'danger' ? 'bg-danger-soft text-danger' : 'bg-surface text-ink-muted',
        )}
      >
        <Icon icon={icon} size={24} />
      </div>
      <h2 className="m-0 text-headline text-balance">{title}</h2>
      {text && <p className="m-0 mb-3 max-w-[280px] text-body text-ink-muted">{text}</p>}
      {action && (
        <Button variant={tone === 'danger' ? 'inverse' : 'primary'} onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  );
}
