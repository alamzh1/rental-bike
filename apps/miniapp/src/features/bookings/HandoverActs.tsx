import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check } from 'lucide-react';
import { Badge, Button, Icon, PriceText } from '@rental/ui';
import type { Booking, ClientHandoverAct, ClientHandoverResponse, Lang } from '@rental/shared';
import { useApp, useHaptic } from '@/app/context';
import { errorCode, errorKey } from '../checkout/errors';
import { useDisplayCurrency } from '../profile/settings';
import { useRefreshBookings } from './api';

function Photos({ urls, label }: { urls: string[]; label: string }) {
  if (urls.length === 0) return null;
  return (
    <ul className="m-0 flex list-none gap-2 overflow-x-auto p-0 no-scrollbar">
      {urls.map((u, i) => (
        <li key={u} className="shrink-0">
          <a href={u} target="_blank" rel="noopener noreferrer">
            <img src={u} alt={`${label} ${i + 1}`} loading="lazy" className="h-[96px] w-[96px] rounded-sm bg-surface object-cover" />
          </a>
        </li>
      ))}
    </ul>
  );
}

function Act({ act, booking }: { act: ClientHandoverAct; booking: Booking }) {
  const { t } = useTranslation();
  const { api } = useApp();
  const haptic = useHaptic();
  const qc = useQueryClient();
  const refresh = useRefreshBookings();
  const confirm = useMutation({
    mutationFn: () => api.request<Booking>(`/bookings/${booking.id}/handover/${act.id}/confirm`, { method: 'POST' }),
    onSuccess: () => {
      haptic.notification('success');
      void qc.invalidateQueries({ queryKey: ['handover', booking.id] });
      refresh(booking.id);
    },
    onError: () => haptic.notification('error'),
  });
  const kind = act.kind === 'ISSUE' ? 'issue' : 'return';
  return (
    <li className="flex flex-col gap-3 border-b border-line py-4 last:border-b-0">
      <div className="flex items-center justify-between gap-2">
        <h3 className="m-0 text-headline">{t(`bookings.handover.${kind}`)}</h3>
        {act.confirmedAt ? <Badge tone="success">{t('bookings.handover.confirmed')}</Badge> : <Badge tone="warning">{t('bookings.handover.waiting')}</Badge>}
      </div>
      <dl className="m-0 flex flex-col gap-1 text-body">
        <div className="flex justify-between gap-3"><dt className="text-ink-muted">{t('bookings.handover.plate')}</dt><dd className="tabular m-0">{act.plate}</dd></div>
        <div className="flex justify-between gap-3"><dt className="text-ink-muted">{t('bookings.handover.mileage')}</dt><dd className="tabular m-0">{act.mileageKm} {t('bookings.handover.km')}</dd></div>
        <div className="flex justify-between gap-3"><dt className="text-ink-muted">{t('bookings.handover.fuel')}</dt><dd className="tabular m-0">{act.fuelLevel}%</dd></div>
        {act.damages && <div className="flex justify-between gap-3"><dt className="text-ink-muted">{t('bookings.handover.damages')}</dt><dd className="m-0 min-w-0 break-words text-right">{act.damages}</dd></div>}
      </dl>
      <Photos urls={act.photoUrls} label={t('bookings.handover.photo')} />
      {!act.confirmedAt && (
        <>
          <Button block icon={Check} iconPosition="start" loading={confirm.isPending} onClick={() => confirm.mutate()}>
            {t('bookings.handover.confirm')}
          </Button>
          {confirm.isError && <p role="alert" className="m-0 text-caption text-danger">{t(errorKey(errorCode(confirm.error)))}</p>}
        </>
      )}
    </li>
  );
}

/** Акты выдачи и возврата, удержания из депозита и сумма к возврату; клиент подтверждает акт. */
export function HandoverActs({ booking: b }: { booking: Booking }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language as Lang;
  const { api } = useApp();
  const display = useDisplayCurrency();
  const q = useQuery({
    queryKey: ['handover', b.id],
    queryFn: () => api.request<ClientHandoverResponse>(`/bookings/${b.id}/handover`),
    refetchInterval: b.status === 'CONFIRMED' || b.status === 'ISSUED' ? 5000 : false,
  });
  const d = q.data;
  if (!d || (d.acts.length === 0 && d.deductions.length === 0)) return null;
  return (
    <section aria-label={t('bookings.handover.title')} className="flex flex-col gap-2">
      <h2 className="m-0 text-title-2">{t('bookings.handover.title')}</h2>
      <ul className="m-0 flex list-none flex-col p-0">{d.acts.map((a) => <Act key={a.id} act={a} booking={b} />)}</ul>
      {d.deductions.length > 0 && (
        <div className="flex flex-col gap-3">
          <h3 className="m-0 text-headline">{t('bookings.handover.deductions')}</h3>
          {d.deductions.map((x) => (
            <div key={x.id} className="flex flex-col gap-2 rounded-md bg-surface p-3">
              <div className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 break-words text-body">{x.reason}</span>
                <PriceText vnd={x.amount} lang={lang} display={display} size="body" />
              </div>
              <Photos urls={x.photoUrls} label={t('bookings.handover.photo')} />
            </div>
          ))}
        </div>
      )}
      {d.depositRefund !== null && (
        <div className="flex items-center justify-between gap-3 rounded-md bg-success-soft p-4 text-success">
          <span className="inline-flex items-center gap-2 text-body-strong"><Icon icon={Check} size={20} />{t('bookings.handover.depositRefund')}</span>
          <PriceText vnd={d.depositRefund} lang={lang} display={display} size="price" className="text-success" mutedClassName="text-success" />
        </div>
      )}
    </section>
  );
}
