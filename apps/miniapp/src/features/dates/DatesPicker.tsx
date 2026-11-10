import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { IconButton, PriceText, Skeleton, cn } from '@rental/ui';
import { formatDate, formatTime } from '@rental/i18n';
import { fromLocationDateTime, rentalDays, type Lang, type Quote, type QuoteRequest } from '@rental/shared';
import { useApp, useHaptic } from '@/app/context';
import { locationHours, useHome } from '../catalog/api';
import { formatRangeShort } from './format';
import type { DateRange } from './range';
import {
  composeRange,
  earliestSlot,
  endTimeOptions,
  localParts,
  monthGrid,
  pickDay,
  startTimeOptions,
  type DaySelection,
} from './slots';

const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
const MAX_MONTHS_AHEAD = 12;

export interface DatesPickerProps {
  /** Модель: занятые для неё даты зачёркнуты, под календарём — итог. Без модели — просто период. */
  modelId?: string;
  initial: DateRange | null;
  /** Готовый период (оба конца выбраны) или null, пока выбор не закончен. */
  onChange: (range: DateRange | null) => void;
}

const ym = (year: number, month: number) => `${year}-${String(month).padStart(2, '0')}`;

/** Календарь диапазона: касание — начало, второе — конец; время слотами по 30 мин; итог под календарём. */
export function DatesPicker({ modelId, initial, onChange }: DatesPickerProps) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language as Lang;
  const { api } = useApp();
  const haptic = useHaptic();
  const home = useHome(null);
  const loc = locationHours(home.data?.location);
  const tz = loc.timezone;

  // «Сейчас» фиксируем на время жизни пикера: слоты не должны прыгать под пальцем.
  const [now] = useState(() => new Date());
  const earliest = useMemo(() => earliestSlot(now, loc), [now, loc.openTime, loc.closeTime, tz]);
  const earliestDate = localParts(earliest, tz).date;

  const init = useMemo(() => {
    if (!initial) return null;
    const a = localParts(new Date(initial.from), tz);
    const b = localParts(new Date(initial.to), tz);
    const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
    return { sel: { start: a.date, end: b.date }, startTime: hhmm(a.minutes), endTime: hhmm(b.minutes) };
  }, []);

  const [sel, setSel] = useState<DaySelection>(init?.sel ?? { start: null, end: null });
  const [startTime, setStartTime] = useState<string | null>(init?.startTime ?? null);
  const [endTime, setEndTime] = useState<string | null>(init?.endTime ?? null);
  const firstDay = init?.sel.start && init.sel.start >= earliestDate ? init.sel.start : earliestDate;
  const [cursor, setCursor] = useState(() => ({ year: Number(firstDay.slice(0, 4)), month: Number(firstDay.slice(5, 7)) }));

  const monthKey = ym(cursor.year, cursor.month);
  const availability = useQuery({
    queryKey: ['availability', modelId, monthKey],
    queryFn: () => api.request<{ busy: string[] }>(`/models/${encodeURIComponent(modelId ?? '')}/availability?month=${monthKey}`),
    enabled: !!modelId,
  });
  const busy = useMemo(() => new Set(availability.data?.busy ?? []), [availability.data]);

  // Время по умолчанию — первое доступное; выбранное сохраняем, пока оно допустимо.
  const startOptions = sel.start ? startTimeOptions(sel.start, earliest, loc) : [];
  const startValue = startTime && startOptions.includes(startTime) ? startTime : (startOptions[0] ?? null);
  const endOptions = sel.start && sel.end && startValue ? endTimeOptions(sel.start, sel.end, startValue, loc) : [];
  const endValue = endTime && endOptions.includes(endTime) ? endTime : (endOptions.includes(startValue ?? '') ? startValue : endOptions[0]) ?? null;

  const composed = useMemo(
    () => (startValue && endValue ? composeRange(sel, startValue, endValue, tz) : null),
    [sel, startValue, endValue, tz],
  );
  const composedKey = composed ? `${composed.from.toISOString()}|${composed.to.toISOString()}` : null;
  useEffect(() => {
    onChange(composed ? { from: composed.from.toISOString(), to: composed.to.toISOString() } : null);
  }, [composedKey]);

  const quote = useQuery({
    queryKey: ['quote-preview', modelId, composedKey],
    queryFn: () => {
      const body: QuoteRequest = {
        modelId: modelId ?? '',
        startAt: (composed as { from: Date }).from.toISOString(),
        endAt: (composed as { to: Date }).to.toISOString(),
      };
      return api.request<Quote>('/quotes', { method: 'POST', json: body });
    },
    enabled: !!modelId && !!composed,
  });

  const isFirstMonth = monthKey <= earliestDate.slice(0, 7);
  const isLastMonth = monthKey >= ym(...addMonths(Number(earliestDate.slice(0, 4)), Number(earliestDate.slice(5, 7)), MAX_MONTHS_AHEAD));
  const shift = (delta: number) => {
    haptic.selection();
    setCursor((c) => {
      const [year, month] = addMonths(c.year, c.month, delta);
      return { year, month };
    });
  };

  const timeLabel = (date: string, hhmm: string) => formatTime(fromLocationDateTime(date, hhmm, tz), lang, tz);
  const monthTitle = new Intl.DateTimeFormat(lang === 'vi' ? 'vi-VN' : lang === 'ru' ? 'ru-RU' : 'en-GB', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(cursor.year, cursor.month - 1, 1)));

  const onDay = (day: string) => {
    haptic.selection();
    setSel((prev) => pickDay(prev, day, busy));
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <IconButton icon={ChevronLeft} label={t('dates.month.prev')} variant="surface" onClick={() => shift(-1)} disabled={isFirstMonth} />
        <h3 className="m-0 text-headline capitalize" aria-live="polite">
          {monthTitle}
        </h3>
        <IconButton icon={ChevronRight} label={t('dates.month.next')} variant="surface" onClick={() => shift(1)} disabled={isLastMonth} />
      </div>

      <div role="grid" aria-label={monthTitle} aria-busy={availability.isFetching}>
        <div role="row" className="mb-1 grid grid-cols-7 text-center text-label text-ink-muted">
          {WEEKDAYS.map((d) => (
            <span key={d} role="columnheader">
              {t(`dates.weekdays.${d}`)}
            </span>
          ))}
        </div>
        {monthGrid(cursor.year, cursor.month).map((week, i) => (
          <div role="row" key={i} className="grid grid-cols-7">
            {week.map((day, j) => {
              if (!day) return <span key={j} role="gridcell" />;
              const past = day < earliestDate;
              const isBusy = busy.has(day);
              const isStart = day === sel.start;
              const isEnd = day === sel.end;
              const inside = !!sel.start && !!sel.end && day > sel.start && day < sel.end;
              const state = isBusy ? t('dates.day.busy') : past ? t('dates.day.past') : isStart ? t('dates.day.start') : isEnd ? t('dates.day.end') : '';
              return (
                <span key={j} role="gridcell" className={cn(
                    'flex justify-center',
                    inside && 'bg-accent-soft',
                    isStart && !!sel.end && sel.end !== day && 'rounded-l-full bg-accent-soft',
                    isEnd && !!sel.start && sel.start !== day && 'rounded-r-full bg-accent-soft',
                  )}>
                  <button
                    type="button"
                    disabled={past || isBusy}
                    aria-pressed={isStart || isEnd}
                    aria-label={`${formatDate(fromLocationDateTime(day, '12:00', tz), lang, tz)}${state ? `, ${state}` : ''}`}
                    onClick={() => onDay(day)}
                    className={cn(
                      'tabular relative h-11 w-11 rounded-full text-body-strong transition-colors duration-fast ease-out',
                      (isStart || isEnd) && 'bg-accent text-on-accent',
                      !isStart && !isEnd && !past && !isBusy && 'text-ink',
                      isBusy && 'text-ink-muted line-through decoration-2',
                      past && 'text-ink-muted opacity-40',
                    )}
                  >
                    {Number(day.slice(8))}
                  </button>
                </span>
              );
            })}
          </div>
        ))}
      </div>
      {modelId && <p className="m-0 text-caption text-ink-muted">{t('dates.legend.busy')}</p>}

      {sel.start && (
        <div className="grid grid-cols-2 gap-3">
          <TimeSelect
            label={t('dates.time.start')}
            value={startValue}
            options={startOptions}
            format={(v) => timeLabel(sel.start as string, v)}
            onChange={(v) => {
              haptic.selection();
              setStartTime(v);
            }}
          />
          <TimeSelect
            label={t('dates.time.end')}
            value={endValue}
            options={endOptions}
            disabled={!sel.end}
            format={(v) => timeLabel(sel.end ?? (sel.start as string), v)}
            onChange={(v) => {
              haptic.selection();
              setEndTime(v);
            }}
          />
        </div>
      )}

      <div className="min-h-[44px] rounded-md bg-surface px-4 py-3 text-body" aria-live="polite">
        {composed ? (
          <p className="m-0 flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className="tabular text-body-strong">
              {t('dates.summary.days', { days: rentalDays(composed.from, composed.to) })} · {formatRangeShort(composed.from, composed.to, lang, tz)}
            </span>
            {modelId &&
              (quote.data ? (
                <PriceText vnd={quote.data.total} lang={lang} size="body" />
              ) : quote.isError ? null : (
                <Skeleton shape="text" className="w-24" />
              ))}
          </p>
        ) : (
          <p className="m-0 text-ink-muted">{sel.start ? t('dates.hint.end') : t('dates.hint.start')}</p>
        )}
      </div>
    </div>
  );
}

function addMonths(year: number, month: number, delta: number): [number, number] {
  const index = year * 12 + (month - 1) + delta;
  return [Math.floor(index / 12), (index % 12) + 1];
}

function TimeSelect({
  label,
  value,
  options,
  format,
  onChange,
  disabled,
}: {
  label: string;
  value: string | null;
  options: string[];
  format: (v: string) => string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1 text-caption text-ink-muted">
      {label}
      <select
        value={value ?? ''}
        disabled={disabled || options.length === 0}
        onChange={(e) => onChange(e.target.value)}
        className="tabular h-control-md w-full rounded-md border border-line-strong bg-bg px-3 text-body-strong text-ink disabled:opacity-40"
      >
        {value === null && <option value="" />}
        {options.map((o) => (
          <option key={o} value={o}>
            {format(o)}
          </option>
        ))}
      </select>
    </label>
  );
}
