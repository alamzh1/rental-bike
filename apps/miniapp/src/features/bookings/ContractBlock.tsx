import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation } from '@tanstack/react-query';
import { Check, FileText } from 'lucide-react';
import { Badge, Button } from '@rental/ui';
import { formatDate, formatTime } from '@rental/i18n';
import type { AcceptContractResponse, Booking, Lang } from '@rental/shared';
import { useApp, useHaptic } from '@/app/context';
import { errorCode, errorKey } from '../checkout/errors';
import { useBookingFile, useRefreshBookings } from './api';

/** Договор аренды: открыть PDF и подтвердить его в приложении (ТЗ §11.1). */
export function ContractBlock({ booking: b }: { booking: Booking }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language as Lang;
  const { api } = useApp();
  const haptic = useHaptic();
  const download = useBookingFile();
  const refresh = useRefreshBookings();
  const [fileError, setFileError] = useState(false);
  const accept = useMutation({
    mutationFn: () => api.request<AcceptContractResponse>(`/bookings/${b.id}/contract/accept`, { method: 'POST' }),
    onSuccess: () => {
      haptic.notification('success');
      refresh(b.id);
    },
    onError: () => haptic.notification('error'),
  });

  const acceptedAt = b.contractAcceptedAt ? new Date(b.contractAcceptedAt) : null;
  const tz = b.location.timezone;
  const open = async () => {
    setFileError(false);
    try {
      await download(b.id, 'contract', lang, `${b.code}.pdf`);
    } catch {
      setFileError(true);
    }
  };

  return (
    <section className="flex flex-col gap-3 rounded-lg bg-surface p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="m-0 text-headline">{t('bookings.contract.title')}</h2>
        {acceptedAt ? <Badge tone="success">{t('bookings.contract.accepted')}</Badge> : <Badge tone="warning">{t('bookings.contract.waiting')}</Badge>}
      </div>
      <p className="m-0 text-body text-ink-muted">
        {acceptedAt
          ? t('bookings.contract.acceptedAt', { date: `${formatDate(acceptedAt, lang, tz)} ${formatTime(acceptedAt, lang, tz)}` })
          : t('bookings.contract.text')}
      </p>
      <Button block variant="secondary" icon={FileText} iconPosition="start" onClick={() => void open()}>
        {t('bookings.contract.open')}
      </Button>
      {fileError && <p role="alert" className="m-0 text-caption text-danger">{t('bookings.actions.fileError')}</p>}
      {!acceptedAt && (
        <>
          <Button block icon={Check} iconPosition="start" loading={accept.isPending} onClick={() => accept.mutate()}>
            {t('bookings.contract.accept')}
          </Button>
          {accept.isError && <p role="alert" className="m-0 text-caption text-danger">{t(errorKey(errorCode(accept.error)))}</p>}
        </>
      )}
    </section>
  );
}
