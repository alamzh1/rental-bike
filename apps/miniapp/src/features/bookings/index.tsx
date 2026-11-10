import { useState } from 'react';
import { Link, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CalendarX, PackageSearch } from 'lucide-react';
import { Badge, Chip, ChipGroup, EmptyState, PriceText, Skeleton, bookingStatusTone, useDelayedFlag } from '@rental/ui';
import { formatDate, formatTime } from '@rental/i18n';
import type { Booking, Lang } from '@rental/shared';
import { useHaptic } from '@/app/context';
import { paths } from '@/app/router';
import { useDisplayCurrency } from '../profile/settings';
import { errorCode, errorKey } from '../checkout/errors';
import { useBooking, useBookings, useNow } from './api';
import { BookingView } from './BookingView';
import { BOOKING_TABS, bookingTab, cardTimer, formatCountdown, initialTab, rentalEnding, type BookingTab } from './status';

function Countdown({ booking: b }: { booking: Booking }) {
  const { t } = useTranslation();
  const now = useNow();
  const timer = cardTimer(b, now);
  if (!timer) return null;
  const ending = rentalEnding(b, now);
  if (ending === 'overdue') return <span className="text-caption font-bold text-danger">{t('bookings.ending.overdueShort')}</span>;
  const tone = timer.kind === 'payWithin' || ending === 'soon' ? 'text-warning' : timer.kind === 'returnIn' ? 'text-success' : 'text-ink';
  return <span className={`tabular text-caption font-bold ${tone}`}>{t(`bookings.card.${timer.kind}`, { time: formatCountdown(timer.ms) })}</span>;
}

function BookingCard({ booking: b }: { booking: Booking }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language as Lang;
  const display = useDisplayCurrency();
  const tz = b.location.timezone;
  const from = new Date(b.startAt);
  const to = new Date(b.endAt);
  return (
    <li>
      <Link to={paths.booking(b.id)} className="flex flex-col gap-2 rounded-lg border border-line bg-surface-raised p-4">
        <span className="flex items-center justify-between gap-2">
          <Badge tone={bookingStatusTone(b.status)}>{t(`bookings.status.${b.status}`)}</Badge>
          <span className="tabular text-caption text-ink-muted">{b.code}</span>
        </span>
        <span className="text-headline">{b.modelName}</span>
        <span className="tabular text-body text-ink-muted">
          {formatDate(from, lang, tz)} {formatTime(from, lang, tz)} — {formatDate(to, lang, tz)} {formatTime(to, lang, tz)}
        </span>
        <span className="flex items-end justify-between gap-3">
          <Countdown booking={b} />
          <PriceText vnd={b.totalAmount} lang={lang} display={display} size="price" approxLayout="below" className="ml-auto" />
        </span>
      </Link>
    </li>
  );
}

function BookingsList() {
  const { t } = useTranslation();
  const haptic = useHaptic();
  const navigate = useNavigate();
  const [picked, setTab] = useState<BookingTab | null>(null);
  const q = useBookings();
  const loading = useDelayedFlag(q.isLoading);

  const all = q.data?.items ?? [];
  // Пока клиент не выбрал вкладку сам — первая непустая («Предстоящие» сразу после оформления).
  const tab = picked ?? initialTab(all);
  const items = all.filter((b) => bookingTab(b.status) === tab);
  return (
    <div className="flex flex-col gap-4 px-4 pt-4">
      <h1 className="m-0 text-title-1">{t('bookings.title')}</h1>
      <ChipGroup label={t('bookings.tabs.label')}>
        {BOOKING_TABS.map((k) => (
          <Chip key={k} selected={tab === k} onClick={() => { haptic.selection(); setTab(k); }}>
            {t(`bookings.tabs.${k}`)}
          </Chip>
        ))}
      </ChipGroup>
      {q.isError ? (
        <EmptyState tone="danger" icon={PackageSearch} title={t('bookings.error.title')} text={t(errorKey(errorCode(q.error)))} action={{ label: t('common.actions.retry'), onClick: () => void q.refetch() }} />
      ) : q.isLoading ? (
        <div aria-busy="true" className="flex flex-col gap-3">
          {loading && [0, 1, 2].map((i) => <Skeleton key={i} className="h-[112px] w-full" />)}
        </div>
      ) : items.length === 0 ? (
        <EmptyState icon={CalendarX} title={t(`bookings.empty.${tab}.title`)} text={t(`bookings.empty.${tab}.text`)} action={{ label: t('bookings.empty.action'), onClick: () => navigate(paths.catalog) }} />
      ) : (
        <ul className="m-0 flex list-none flex-col gap-3 p-0">{items.map((b) => <BookingCard key={b.id} booking={b} />)}</ul>
      )}
    </div>
  );
}

/** Экран брони по id: ссылка бота startapp=booking_<id> и переход из списка. */
export function BookingDetail({ id: idProp, celebrate }: { id?: string; celebrate?: boolean }) {
  const params = useParams();
  const id = idProp ?? params.id ?? '';
  const { t } = useTranslation();
  const q = useBooking(id);
  if (q.isError)
    return <EmptyState tone="danger" icon={PackageSearch} title={t('bookings.error.title')} text={t(errorKey(errorCode(q.error)))} action={{ label: t('common.actions.retry'), onClick: () => void q.refetch() }} className="mt-8" />;
  if (!q.data)
    return (
      <div aria-busy="true" className="flex flex-col gap-4 px-4 pt-2">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-6 w-1/3" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-[128px] w-full" />
      </div>
    );
  return <BookingView booking={q.data} celebrate={celebrate} />;
}

export default function BookingsScreen() {
  return (
    <Routes>
      <Route index element={<BookingsList />} />
      <Route path=":id" element={<BookingDetail />} />
    </Routes>
  );
}
