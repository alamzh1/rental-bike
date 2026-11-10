import { useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Clock, ExternalLink, PackageSearch, TimerOff } from 'lucide-react';
import { Button, EmptyState, Icon, PriceText, Skeleton } from '@rental/ui';
import type { Booking, DevPayRequest, Lang, PayBookingResponse } from '@rental/shared';
import { useApp, useHaptic } from '@/app/context';
import { paths } from '@/app/router';
import { useBooking, useNow, useRefreshBookings } from '../bookings/api';
import { BookingView } from '../bookings/BookingView';
import { formatCountdown, remainingMs } from '../bookings/status';
import { errorCode, errorKey } from '../checkout/errors';
import { useDisplayCurrency } from '../profile/settings';
import { QrCode } from '@rental/ui';
import { RubTransfer } from './RubTransfer';

function PaymentSkeleton() {
  return (
    <div aria-busy="true" className="flex flex-col items-center gap-4 px-4 pt-6">
      <Skeleton className="h-8 w-1/2" />
      <Skeleton className="h-[256px] w-[256px]" />
      <Skeleton className="h-10 w-2/3" />
    </div>
  );
}

/** Оплата VietQR: QR, сумма, «Открыть банк», таймер удержания; статус обновляется сам (раз в 3 с). */
function PendingPayment({ booking: b }: { booking: Booking }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language as Lang;
  const { api } = useApp();
  const display = useDisplayCurrency();
  const refresh = useRefreshBookings();
  const navigate = useNavigate();
  const now = useNow();

  const pay = useQuery({
    queryKey: ['pay', b.id],
    queryFn: () => api.request<PayBookingResponse>(`/bookings/${b.id}/pay`, { method: 'POST' }),
    staleTime: Infinity,
    retry: false,
    // Администратор мог не найти перевод: отметка «Я перевёл» снимается и клиент снова видит реквизиты
    refetchInterval: (q) => (q.state.data?.rub?.claimedAt ? 15_000 : false),
  });
  // dev: оплата тестовым провайдером. В проде кнопки нет — деньги подтверждает webhook.
  const devPay = useMutation({
    mutationFn: (p: PayBookingResponse) => api.request<unknown>(`/dev/payments/${p.paymentId}/pay`, { method: 'POST', json: {} satisfies DevPayRequest }),
    onSuccess: () => refresh(b.id),
  });

  const hold = b.holdExpiresAt ? remainingMs(b.holdExpiresAt, now) : null;
  const expired = hold === 0;

  if (pay.isError) {
    const code = errorCode(pay.error);
    return (
      <EmptyState
        tone="danger"
        icon={PackageSearch}
        title={t('payment.error.title')}
        text={t(errorKey(code))}
        action={code === 'HOLD_EXPIRED' ? { label: t('payment.expired.action'), onClick: () => navigate(paths.catalog, { replace: true }) } : { label: t('common.actions.retry'), onClick: () => void pay.refetch() }}
        className="mt-8"
      />
    );
  }
  if (expired)
    return <EmptyState icon={TimerOff} title={t('payment.expired.title')} text={t('payment.expired.text')} action={{ label: t('payment.expired.action'), onClick: () => navigate(paths.catalog, { replace: true }) }} className="mt-8" />;
  if (!pay.data) return <PaymentSkeleton />;
  const p = pay.data;
  if (p.rub) return <RubTransfer pay={p} bookingId={b.id} hold={hold} />;

  return (
    <div className="flex flex-col items-center gap-5 px-4 pt-2 text-center">
      <h1 className="m-0 w-full text-left text-title-1 text-balance">{t('payment.title')}</h1>
      <div className="w-full max-w-[280px] rounded-xl bg-surface p-4">
        <QrCode value={p.qrPayload} label={t('payment.qr.label')} className="aspect-square w-full rounded-md" />
      </div>
      <div className="flex flex-col items-center gap-1">
        <PriceText vnd={p.amount} lang={lang} display={display} size="price-lg" approxLayout="below" className="items-center" />
        <p className="m-0 text-caption text-ink-muted">{t('payment.transfer', { code: p.description })}</p>
      </div>
      {hold !== null && (
        <p className="m-0 flex items-center gap-2 text-body-strong text-warning" role="timer">
          <Icon icon={Clock} size={20} />
          {t('payment.timer')} <span className="tabular">{formatCountdown(hold)}</span>
        </p>
      )}
      {p.deeplink && (
        <Button block size="lg" icon={ExternalLink} onClick={() => window.open(p.deeplink!, '_blank', 'noopener')}>
          {t('payment.openBank')}
        </Button>
      )}
      <p className="m-0 flex items-center gap-2 text-caption text-ink-muted" aria-live="polite">
        <span aria-hidden className="h-2 w-2 animate-pulse rounded-full bg-accent" />
        {t('payment.waiting')}
      </p>
      {p.provider === 'test' && (
        <Button block variant="secondary" loading={devPay.isPending} onClick={() => devPay.mutate(p)}>
          {t('payment.devPay')}
        </Button>
      )}
      {devPay.isError && <p role="alert" className="m-0 text-caption text-danger">{t(errorKey(errorCode(devPay.error)))}</p>}
    </div>
  );
}

/** Экран оплаты и «Бронь подтверждена». Переход PENDING_PAYMENT → CONFIRMED — без нажатий клиента. */
export default function PaymentScreen() {
  const { bookingId = '' } = useParams();
  const { t } = useTranslation();
  const haptic = useHaptic();
  const navigate = useNavigate();
  const q = useBooking(bookingId);
  const sawPending = useRef(false);
  const status = q.data?.status;

  const queryClient = useQueryClient();
  useEffect(() => {
    if (status === 'PENDING_PAYMENT') sawPending.current = true;
    else if (status === 'CONFIRMED' && sawPending.current) {
      sawPending.current = false;
      haptic.notification('success');
      void queryClient.invalidateQueries({ queryKey: ['bookings'] });
    }
  }, [status, haptic, queryClient]);

  if (q.isError)
    return <EmptyState tone="danger" icon={PackageSearch} title={t('payment.error.title')} text={t(errorKey(errorCode(q.error)))} action={{ label: t('common.actions.retry'), onClick: () => void q.refetch() }} className="mt-8" />;
  if (!q.data) return <PaymentSkeleton />;
  const b = q.data;
  // наличные с предоплатой тоже оплачиваются через VietQR
  if (b.status === 'PENDING_PAYMENT') return <PendingPayment booking={b} />;
  return (
    <>
      <BookingView booking={b} celebrate />
      <div className="px-4 pt-4">
        <Button block variant="ghost" onClick={() => navigate(paths.bookings, { replace: true })}>
          {t('payment.toBookings')}
        </Button>
      </div>
    </>
  );
}
