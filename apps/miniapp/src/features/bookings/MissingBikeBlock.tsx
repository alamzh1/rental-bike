import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMutation } from '@tanstack/react-query';
import { AlertTriangle } from 'lucide-react';
import { INCIDENT_REPORT_BEFORE_START_HOURS, type Booking } from '@rental/shared';
import { formatPrice } from '@rental/i18n';
import { Button, Icon, Sheet } from '@rental/ui';
import { useApp, useHaptic } from '@/app/context';
import { paths } from '@/app/router';
import { errorCode, errorKey } from '../checkout/errors';
import { useRefreshBookings } from './api';

const H = 3_600_000;

/** Клиент приехал, а байка нет: сообщить точке, принять замену или отменить с полным возвратом. */
export function MissingBikeBlock({ booking: b, now, lang }: { booking: Booking; now: number; lang: 'ru' | 'en' | 'vi' }) {
  const { t } = useTranslation();
  const { api } = useApp();
  const haptic = useHaptic();
  const navigate = useNavigate();
  const refresh = useRefreshBookings();
  const [open, setOpen] = useState(false);
  const [comment, setComment] = useState('');
  const act = useMutation({
    mutationFn: (v: { path: string; json?: unknown }) => api.request<Booking>(`/bookings/${b.id}/bike-missing${v.path}`, { method: 'POST', ...(v.json ? { json: v.json } : {}) }),
    onSuccess: () => {
      haptic.notification('success');
      setOpen(false);
      refresh(b.id);
    },
    onError: () => {
      haptic.notification('error');
      refresh(b.id);
    },
  });
  const error = act.isError ? <p role="alert" className="m-0 text-caption text-danger">{t(errorKey(errorCode(act.error)))}</p> : null;
  const incident = b.incident;

  if (!incident) {
    if (b.status !== 'CONFIRMED' || now < Date.parse(b.startAt) - INCIDENT_REPORT_BEFORE_START_HOURS * H) return null;
    return (
      <>
        <Button block variant="secondary" icon={AlertTriangle} iconPosition="start" onClick={() => setOpen(true)}>
          {t('bookings.missing.button')}
        </Button>
        <Sheet
          open={open}
          onClose={() => setOpen(false)}
          title={t('bookings.missing.title')}
          closeLabel={t('common.actions.close')}
          footer={
            <Button block loading={act.isPending} onClick={() => act.mutate({ path: '', json: { comment: comment.trim() || undefined } })}>
              {t('bookings.missing.send')}
            </Button>
          }
        >
          <div className="flex flex-col gap-3 pb-2">
            <p className="m-0 text-body text-ink-muted">{t('bookings.missing.text')}</p>
            <label className="flex flex-col gap-1">
              <span className="text-caption font-semibold text-ink-muted">{t('bookings.missing.comment')}</span>
              <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={3} maxLength={1000} className="w-full resize-none rounded-md border border-line-strong bg-bg p-3 text-body text-ink" />
            </label>
            {error}
          </div>
        </Sheet>
      </>
    );
  }

  const free = !!incident.cancelFreeAt && now >= Date.parse(incident.cancelFreeAt);
  const minutes = incident.cancelFreeAt ? Math.max(1, Math.ceil((Date.parse(incident.cancelFreeAt) - now) / 60_000)) : 0;
  return (
    <section className="flex flex-col gap-3 rounded-lg bg-warning-soft p-4">
      <p className="m-0 flex items-start gap-2 text-body-strong">
        <Icon icon={AlertTriangle} size={20} />
        <span>{t(incident.proposal ? 'bookings.missing.offerTitle' : 'bookings.missing.waitTitle')}</span>
      </p>
      {incident.proposal ? (
        <>
          <p className="m-0 text-body">{t('bookings.missing.offerText', { model: incident.proposal.modelName, plate: incident.proposal.plate })}</p>
          <p className="m-0 text-body">{incident.proposal.refund > 0 ? t('bookings.missing.offerRefund', { amount: formatPrice(incident.proposal.refund, lang) }) : t('bookings.missing.offerFree')}</p>
          <Button block loading={act.isPending} onClick={() => act.mutate({ path: '/accept' })}>{t('bookings.missing.accept')}</Button>
        </>
      ) : (
        <p className="m-0 text-body">{incident.disputed ? t('bookings.missing.disputed') : free ? t('bookings.missing.waitOver') : t('bookings.missing.waitText', { minutes })}</p>
      )}
      {free && (
        <Button block variant="secondary" loading={act.isPending} onClick={() => act.mutate({ path: '/cancel' })}>
          {t('bookings.missing.cancel')}
        </Button>
      )}
      <Button block variant="ghost" onClick={() => navigate(paths.catalog)}>{t('bookings.missing.others')}</Button>
      {error}
    </section>
  );
}
