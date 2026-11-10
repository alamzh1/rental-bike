import { lazy, Suspense, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CalendarDays, ChevronRight } from 'lucide-react';
import { Button, Chip, ChipGroup, Icon, Sheet, Skeleton } from '@rental/ui';
import { rentalDays, type Lang } from '@rental/shared';
import { useHaptic } from '@/app/context';
import { locationHours, useHome, useTrack } from '../catalog/api';
import { formatRangeShort } from '../dates/format';
import type { DateRange } from '../dates/range';
import { QUICK_KINDS, quickRange, type QuickKind } from '../dates/slots';
import { useDates } from '../dates/store';

// Календарь грузится только при открытии шторки: на первом экране его кода нет.
const DatesPicker = lazy(() => import('../dates/DatesPicker').then((m) => ({ default: m.DatesPicker })));

/** «Когда нужен байк?»: быстрые кнопки и календарь диапазона. Даты уходят в стор и URL. */
export function DatesBlock() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language as Lang;
  const haptic = useHaptic();
  const track = useTrack();
  const { range, setRange } = useDates();
  const home = useHome(null);
  const loc = locationHours(home.data?.location);
  const [quick, setQuick] = useState<{ kind: QuickKind; range: DateRange } | null>(null);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DateRange | null>(null);

  const choose = (kind: QuickKind) => {
    haptic.selection();
    const r = quickRange(kind, new Date(), loc);
    const next = { from: r.from.toISOString(), to: r.to.toISOString() };
    setQuick({ kind, range: next });
    setRange(next);
    track('dates_selected', { from: next.from, to: next.to, source: `quick_${kind}` });
  };

  const activeKind = quick && range && quick.range.from === range.from && quick.range.to === range.to ? quick.kind : null;
  const summary = range
    ? `${t('dates.summary.days', { days: rentalDays(new Date(range.from), new Date(range.to)) })} · ${formatRangeShort(new Date(range.from), new Date(range.to), lang, loc.timezone)}`
    : null;

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-line bg-surface-raised p-4" aria-labelledby="dates-title">
      <h2 id="dates-title" className="m-0 text-title-2 text-balance">
        {t('dates.title')}
      </h2>
      <ChipGroup label={t('dates.quick.label')} scroll>
        {QUICK_KINDS.map((k) => (
          <Chip key={k} selected={activeKind === k} onClick={() => choose(k)} disabled={!home.data}>
            {t(`dates.quick.${k}`)}
          </Chip>
        ))}
      </ChipGroup>
      <button
        type="button"
        onClick={() => {
          haptic.selection();
          setDraft(null);
          setOpen(true);
        }}
        className="flex min-h-control-md items-center gap-3 rounded-md bg-surface px-4 py-2 text-left"
      >
        <Icon icon={CalendarDays} size={20} className="text-ink-muted" />
        <span className="tabular flex-1 text-body-strong" aria-live="polite">
          {summary ?? t('dates.pickInCalendar')}
        </span>
        <Icon icon={ChevronRight} size={20} className="text-ink-muted" />
      </button>

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title={t('dates.title')}
        closeLabel={t('common.actions.close')}
        footer={
          <Button
            size="lg"
            block
            disabled={!draft}
            onClick={() => {
              if (!draft) return;
              setRange(draft);
              setQuick(null);
              track('dates_selected', { from: draft.from, to: draft.to, source: 'calendar' });
              setOpen(false);
            }}
          >
            {draft ? t('dates.apply.sheet') : t('dates.apply.pending')}
          </Button>
        }
      >
        <Suspense fallback={<PickerSkeleton />}>
          <DatesPicker initial={range} onChange={setDraft} />
        </Suspense>
      </Sheet>
    </section>
  );
}

function PickerSkeleton() {
  return (
    <div aria-busy="true" className="flex flex-col gap-3">
      <Skeleton className="h-control-md w-full" />
      <Skeleton className="h-60 w-full" />
    </div>
  );
}
