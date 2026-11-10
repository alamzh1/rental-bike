import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, Clock, Copy, Hourglass } from 'lucide-react';
import { Button, Icon } from '@rental/ui';
import { formatPrice } from '@rental/i18n';
import type { Lang, PayBookingResponse } from '@rental/shared';
import { useApp, useHaptic } from '@/app/context';
import { errorCode, errorKey } from '../checkout/errors';
import { formatCountdown } from '../bookings/status';
import { formatRub } from './rub';

function CopyRow({ label, value, shown }: { label: string; value: string; shown?: string }) {
  const { t } = useTranslation();
  const haptic = useHaptic();
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(value).catch(() => undefined);
    haptic.selection();
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button type="button" onClick={() => void copy()} aria-label={t('payment.rub.copy', { label })} className="flex min-h-control-md w-full items-center gap-3 border-b border-line py-2 text-left last:border-b-0">
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-caption text-ink-muted">{label}</span>
        <span className="tabular text-body-strong break-words">{shown ?? value}</span>
      </span>
      <Icon icon={copied ? Check : Copy} size={20} className={copied ? 'text-success' : 'text-accent-text'} />
    </button>
  );
}

/** Перевод в рублях: сумма зафиксирована, реквизиты копируются по нажатию; бронь подтверждает администратор, увидев деньги. */
export function RubTransfer({ pay, bookingId, hold }: { pay: PayBookingResponse; bookingId: string; hold: number | null }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language as Lang;
  const { api } = useApp();
  const haptic = useHaptic();
  const qc = useQueryClient();
  const rub = pay.rub!;
  const claim = useMutation({
    mutationFn: () => api.request<PayBookingResponse>(`/bookings/${bookingId}/pay/claim`, { method: 'POST' }),
    onSuccess: (r) => {
      haptic.notification('success');
      qc.setQueryData(['pay', bookingId], r);
    },
    onError: () => haptic.notification('error'),
  });
  const amount = String(rub.amount);
  return (
    <div className="flex flex-col gap-5 px-4 pt-2">
      <h1 className="m-0 text-title-1 text-balance">{t('payment.rub.title')}</h1>
      <div className="flex flex-col items-center gap-1 rounded-xl bg-surface p-5 text-center">
        <p className="tabular m-0 text-price-lg">{formatRub(rub.amount, lang)}</p>
        <p className="tabular m-0 text-caption text-ink-muted">{t('payment.rub.equals', { vnd: formatPrice(pay.amount, lang) })}</p>
        {rub.depositCash > 0 && <p className="tabular m-0 text-caption text-ink-muted">{t('payment.rub.depositCash', { amount: formatPrice(rub.depositCash, lang) })}</p>}
      </div>
      {rub.claimedAt ? (
        <div role="status" className="flex gap-3 rounded-md bg-accent-soft p-4">
          <Icon icon={Hourglass} size={20} className="mt-0.5 text-accent-text" />
          <div className="flex flex-col gap-1">
            <p className="m-0 text-body-strong">{t('payment.rub.checkingTitle')}</p>
            <p className="m-0 text-body text-ink-muted">{t('payment.rub.checkingText')}</p>
          </div>
        </div>
      ) : (
        <>
          <p className="m-0 text-body text-ink-muted">{t('payment.rub.steps')}</p>
          <div className="flex flex-col rounded-lg border border-line px-4 py-1">
            <CopyRow label={t('payment.rub.phone')} value={rub.phone} />
            <CopyRow label={t('payment.rub.bank')} value={rub.bank} />
            <CopyRow label={t('payment.rub.recipient')} value={rub.recipient} />
            <CopyRow label={t('payment.rub.amount')} value={amount} shown={formatRub(rub.amount, lang)} />
            <CopyRow label={t('payment.rub.comment')} value={pay.description} />
          </div>
          {hold !== null && (
            <p className="m-0 flex items-center gap-2 text-body-strong text-warning" role="timer">
              <Icon icon={Clock} size={20} />
              {t('payment.timer')} <span className="tabular">{formatCountdown(hold)}</span>
            </p>
          )}
          {claim.isError && <p role="alert" className="m-0 text-caption text-danger">{t(errorKey(errorCode(claim.error)))}</p>}
          <Button block size="lg" loading={claim.isPending} onClick={() => claim.mutate()}>{t('payment.rub.claim')}</Button>
          <p className="m-0 text-caption text-ink-muted">{t('payment.rub.note')}</p>
        </>
      )}
    </div>
  );
}
