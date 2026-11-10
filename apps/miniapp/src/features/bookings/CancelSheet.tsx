import { useTranslation } from 'react-i18next';
import { useMutation } from '@tanstack/react-query';
import { Button, PriceText, Sheet } from '@rental/ui';
import type { Booking, CancelBookingResponse, Lang } from '@rental/shared';
import { useApp, useHaptic } from '@/app/context';
import { errorCode, errorKey } from '../checkout/errors';
import { useDisplayCurrency } from '../profile/settings';
import { useRefreshBookings } from './api';

/** Отмена: сумма возврата показана до подтверждения (cancelPreview). */
export function CancelSheet({ booking: b, open, onClose }: { booking: Booking; open: boolean; onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language as Lang;
  const { api } = useApp();
  const haptic = useHaptic();
  const display = useDisplayCurrency();
  const refresh = useRefreshBookings();
  const preview = b.cancelPreview;
  const cancel = useMutation({
    mutationFn: () => api.request<CancelBookingResponse>(`/bookings/${b.id}/cancel`, { method: 'POST' }),
    onSuccess: () => {
      haptic.notification('success');
      refresh(b.id);
      onClose();
    },
    onError: () => haptic.notification('error'),
  });
  if (!preview) return null;
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t('bookings.cancel.title')}
      closeLabel={t('common.actions.close')}
      footer={
        <div className="flex flex-col gap-2">
          <Button block variant="inverse" loading={cancel.isPending} onClick={() => cancel.mutate()}>
            {t('bookings.cancel.confirm')}
          </Button>
          <Button block variant="secondary" onClick={onClose}>
            {t('bookings.cancel.keep')}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-3 pb-2">
        <p className="m-0 text-body text-ink-muted">{t('bookings.cancel.text')}</p>
        <div className="flex items-baseline justify-between gap-3 rounded-md bg-surface p-4">
          <span className="text-body-strong">{t('bookings.cancel.refund', { percent: preview.refundPercent })}</span>
          <PriceText vnd={preview.refundAmount} lang={lang} display={display} size="price" approxLayout="below" />
        </div>
        <p className="m-0 text-caption text-ink-muted">{t('bookings.cancel.rule')}</p>
        {cancel.isError && <p role="alert" className="m-0 text-caption text-danger">{t(errorKey(errorCode(cancel.error)))}</p>}
      </div>
    </Sheet>
  );
}
