import { useTranslation } from 'react-i18next';
import { cn } from '@rental/ui';
import { leftParts } from './kit';

const HOURS_AS_DAYS = 48;

/** Сколько осталось до возврата; меньше суток — предупреждение, после срока — просрочка. */
export function RentalLeft({ endAt }: { endAt: string }) {
  const { t } = useTranslation();
  const p = leftParts(endAt, Date.now());
  const key = p.overdue ? 'lateBy' : 'left';
  const text = p.hours >= HOURS_AS_DAYS ? t(`admin-ops.tracking.${key}Days`, { days: Math.floor(p.hours / 24), hours: p.hours % 24 }) : t(`admin-ops.tracking.${key}`, { hours: p.hours, minutes: p.minutes });
  return <span className={cn('tabular', p.overdue ? 'font-bold text-danger' : p.hours < 24 ? 'font-bold text-warning' : 'text-ink-muted')}>{text}</span>;
}
