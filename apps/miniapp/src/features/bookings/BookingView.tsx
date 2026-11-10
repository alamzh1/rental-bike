import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, CalendarPlus, Check, Clock, LifeBuoy, MapPin, MessageCircle, Navigation } from 'lucide-react';
import { Badge, Button, Icon, PriceText, QrCode, bookingStatusTone } from '@rental/ui';
import { formatDate, formatTime } from '@rental/i18n';
import type { Booking, Lang } from '@rental/shared';
import { useHaptic } from '@/app/context';
import { paths } from '@/app/router';
import { contactHref, useDisplayCurrency, usePublicSettings } from '../profile/settings';
import { useBookingFile, useNow } from './api';
import { ContractBlock } from './ContractBlock';
import { HandoverActs } from './HandoverActs';
import { MissingBikeBlock } from './MissingBikeBlock';
import { CancelSheet } from './CancelSheet';
import { ProblemSheet } from './ProblemSheet';
import { formatCountdown, remainingMs, rentalEnding } from './status';

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1">
      <dt className="text-body text-ink-muted">{label}</dt>
      <dd className="m-0 min-w-0 break-words text-right">{children}</dd>
    </div>
  );
}

/** Карточка брони по статусу (история 68): таймеры, QR, адрес, суммы, действия. */
export function BookingView({ booking: b, celebrate = false }: { booking: Booking; celebrate?: boolean }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language as Lang;
  const navigate = useNavigate();
  const haptic = useHaptic();
  const now = useNow();
  const display = useDisplayCurrency();
  const settings = usePublicSettings();
  const download = useBookingFile();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [problemOpen, setProblemOpen] = useState(false);
  const [fileError, setFileError] = useState(false);

  const tz = b.location.timezone;
  const from = new Date(b.startAt);
  const to = new Date(b.endAt);
  const price = (vnd: number) => <PriceText vnd={vnd} lang={lang} display={display} size="body" />;
  const contact = contactHref(b.location.contact ?? settings.data?.managerContact);
  const when = (d: Date) => `${formatDate(d, lang, tz)} ${formatTime(d, lang, tz)}`;
  const calendar = async () => {
    setFileError(false);
    try {
      await download(b.id, 'calendar', lang, `${b.code}.ics`);
    } catch {
      setFileError(true);
    }
  };

  const confirmed = b.status === 'CONFIRMED';
  const issued = b.status === 'ISSUED';
  const ending = rentalEnding(b, now);
  // При случае «байка нет» обычная отмена вернула бы деньги по правилам: клиенту предлагается полный возврат в блоке случая
  const canCancel = b.cancelPreview !== null && !b.incident && (b.status === 'CONFIRMED' || b.status === 'PENDING_PAYMENT');
  const canReport = issued || confirmed || b.status === 'PROBLEM';

  return (
    <div className="flex flex-col gap-6 px-4 pt-2">
      <header className="flex flex-col gap-2">
        {celebrate && confirmed ? (
          <>
            <div className="grid h-14 w-14 place-items-center rounded-full bg-success-soft text-success">
              <Icon icon={Check} size={24} />
            </div>
            <h1 className="m-0 text-display text-balance">{t('bookings.confirmed.title')}</h1>
          </>
        ) : (
          <h1 className="m-0 text-title-1 text-balance">{b.modelName}</h1>
        )}
        <p className="m-0 flex flex-wrap items-center gap-2">
          <Badge tone={bookingStatusTone(b.status)}>{t(`bookings.status.${b.status}`)}</Badge>
          <span className="tabular text-headline">{b.code}</span>
        </p>
        {celebrate && confirmed && <p className="m-0 text-body text-ink-muted">{b.modelName}</p>}
      </header>

      {b.status === 'PENDING_PAYMENT' && b.holdExpiresAt && (
        <section className="flex flex-col gap-3 rounded-lg bg-warning-soft p-4 text-warning">
          <p className="m-0 flex items-center gap-2 text-body-strong">
            <Icon icon={Clock} size={20} />
            <span>{t('bookings.pending.hold')}</span>
            <span className="tabular ml-auto text-price" aria-live="off">{formatCountdown(remainingMs(b.holdExpiresAt, now))}</span>
          </p>
          <Button block onClick={() => navigate(paths.payment(b.id))}>{t('bookings.pending.pay')}</Button>
        </section>
      )}

      {confirmed && (
        <section className="flex flex-col items-center gap-3 rounded-lg bg-surface p-4">
          <QrCode value={b.code} label={t('bookings.qr.label', { code: b.code })} className="h-[192px] w-[192px] rounded-md" />
          <p className="m-0 text-center text-caption text-ink-muted">{t('bookings.qr.hint')}</p>
        </section>
      )}

      {issued && (
        <section className={`flex flex-col gap-2 rounded-lg p-4 ${ending === 'overdue' ? 'bg-danger-soft text-danger' : ending === 'soon' ? 'bg-warning-soft text-warning' : 'bg-success-soft text-success'}`}>
          <div className="flex items-center gap-3">
            <Icon icon={ending === 'overdue' ? AlertTriangle : Clock} size={20} />
            <p className="m-0 flex-1 text-body-strong">{t(ending === 'overdue' ? 'bookings.ending.overdueTitle' : ending === 'soon' ? 'bookings.ending.soonTitle' : 'bookings.issued.untilReturn')}</p>
            {ending !== 'overdue' && <span className="tabular text-price">{formatCountdown(remainingMs(b.endAt, now))}</span>}
          </div>
          {ending && (
            <p className="m-0 text-body">{t(ending === 'overdue' ? 'bookings.ending.overdueText' : 'bookings.ending.soonText', { date: when(to), address: b.deliveryMethod === 'DELIVERY' && b.deliveryAddress ? b.deliveryAddress : b.location.address })}</p>
          )}
        </section>
      )}

      {b.status === 'COMPLETED' && (
        <p className="m-0 text-body">{t('bookings.completed.text')}{b.refundAmount !== null && b.refundAmount > 0 && ` ${t('bookings.completed.depositBack')}`}</p>
      )}

      {b.status === 'CANCELLED_BY_CLIENT' && (
        <p className="m-0 text-body">
          {t('bookings.cancelled.client')} {b.refundAmount !== null && <span className="text-body-strong">{t('bookings.cancelled.refund')} {price(b.refundAmount)}</span>}
        </p>
      )}
      {b.status === 'CANCELLED_BY_SYSTEM' && (
        <p className="m-0 text-body">{t(b.cancelReason === 'BIKE_MISSING' ? 'bookings.cancelled.bikeMissing' : b.cancelReason === 'NO_SHOW' ? 'bookings.cancelled.noShow' : 'bookings.cancelled.notPaid')}</p>
      )}
      {b.status === 'PROBLEM' && (
        <section className="flex flex-col gap-3 rounded-lg bg-danger-soft p-4 text-danger">
          <p className="m-0 flex items-start gap-2 text-body-strong">
            <Icon icon={AlertTriangle} size={20} />
            <span>{t('bookings.problem.text')}</span>
          </p>
        </section>
      )}

      <MissingBikeBlock booking={b} now={now} lang={lang} />

      <dl className="m-0 flex flex-col">
        <Row label={t('bookings.details.from')}><span className="tabular">{when(from)}</span></Row>
        <Row label={t('bookings.details.to')}><span className="tabular">{when(to)}</span></Row>
        <Row label={b.deliveryMethod === 'DELIVERY' ? t('bookings.details.deliveryAddress') : t('bookings.details.pickup')}>
          {b.deliveryMethod === 'DELIVERY' && b.deliveryAddress ? b.deliveryAddress : b.location.address}
        </Row>
        <Row label={t('bookings.details.rent')}>{price(b.rentAmount)}</Row>
        {b.extrasAmount > 0 && <Row label={t('bookings.details.extras')}>{price(b.extrasAmount)}</Row>}
        {b.deliveryAmount > 0 && <Row label={t('bookings.details.delivery')}>{price(b.deliveryAmount)}</Row>}
        <Row label={t(b.paymentMethod === 'RUB_TRANSFER' ? 'bookings.details.depositCash' : 'bookings.details.deposit')}>{price(b.depositAmount)}</Row>
        {b.lateFeeAmount > 0 && <Row label={t('bookings.details.deduction')}>{price(b.lateFeeAmount)}</Row>}
        <Row label={t('bookings.details.method')}>{t(b.paymentMethod === 'VIETQR' ? 'checkout.method.vietqr' : b.paymentMethod === 'RUB_TRANSFER' ? 'checkout.method.rub' : 'checkout.method.cash')}</Row>
      </dl>

      {(confirmed || issued) && <ContractBlock booking={b} />}

      {(confirmed || issued || b.status === 'COMPLETED' || b.status === 'PROBLEM') && <HandoverActs booking={b} />}

      <div className="flex flex-col gap-2">
        {(confirmed || issued) && (
          <>
            <Button block variant="secondary" icon={Navigation} iconPosition="start" onClick={() => window.open(b.location.mapsUrl, '_blank', 'noopener')}>
              {t('bookings.actions.maps')}
            </Button>
            <Button block variant="secondary" icon={CalendarPlus} iconPosition="start" onClick={() => void calendar()}>
              {t('bookings.actions.calendar')}
            </Button>
            {fileError && <p role="alert" className="m-0 text-caption text-danger">{t('bookings.actions.fileError')}</p>}
          </>
        )}
        {contact ? (
          <Button block variant="secondary" icon={MessageCircle} iconPosition="start" onClick={() => window.open(contact, '_blank', 'noopener')}>
            {t('bookings.actions.contact')}
          </Button>
        ) : (
          <p className="m-0 flex items-center gap-2 text-caption text-ink-muted">
            <Icon icon={MapPin} size={16} />
            {t('bookings.actions.contactPlaceholder')}
          </p>
        )}
        {canReport && (
          <Button block variant="ghost" icon={LifeBuoy} iconPosition="start" onClick={() => { haptic.selection(); setProblemOpen(true); }}>
            {t('bookings.actions.problem')}
          </Button>
        )}
        {canCancel && (
          <Button block variant="ghost" className="text-danger" onClick={() => { haptic.selection(); setCancelOpen(true); }}>
            {t('bookings.actions.cancel')}
          </Button>
        )}
      </div>

      <CancelSheet booking={b} open={cancelOpen} onClose={() => setCancelOpen(false)} />
      <ProblemSheet booking={b} open={problemOpen} onClose={() => setProblemOpen(false)} contact={contact} />
    </div>
  );
}
