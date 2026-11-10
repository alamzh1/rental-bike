import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Phone, SearchX } from 'lucide-react';
import type { ReturnResponse } from '@rental/shared';
import { Badge, Button, EmptyState, Skeleton, bookingStatusTone, useDelayedFlag } from '@rental/ui';
import { ApiRequestError } from '@/app/session/api';
import { useBookingDetail, useManagerActions } from './api';
import { CashBlock, DocumentsBlock, HandoverForm, HandoverWaiting, NoShowBlock, ReturnForm } from './forms';
import { errorKey } from '../checkout/errors';
import { IncidentBlock } from './IncidentBlock';
import { Row, Section, useFormat } from './ui';

/** Бронь менеджера: сверка документов, наличные, выдача с фотоактом, возврат, «Не пришёл». */
export function BookingScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const f = useFormat();
  const { code = '' } = useParams();
  const ref = decodeURIComponent(code);
  const q = useBookingDetail(ref);
  const actions = useManagerActions(q.data?.card.id ?? ref);
  const [returned, setReturned] = useState<ReturnResponse | null>(null);
  const [cancelled, setCancelled] = useState(false);
  const skeleton = useDelayedFlag(q.isPending);

  if (q.isPending) {
    return (
      <div aria-busy="true" className="flex flex-col gap-4">
        {skeleton && (
          <>
            <Skeleton className="h-8 w-2/3" />
            <Skeleton className="h-24" />
            <Skeleton className="h-40" />
          </>
        )}
      </div>
    );
  }
  if (q.isError) {
    const err = q.error instanceof ApiRequestError ? q.error : null;
    const notFound = err?.code === 'NOT_FOUND';
    return (
      <EmptyState
        tone="danger"
        icon={SearchX}
        title={notFound ? t('manager.booking.notFound') : err?.code === 'WRONG_LOCATION' ? t('manager.booking.wrongLocation') : t(errorKey(err?.code ?? 'UNKNOWN'))}
        action={notFound || err?.code === 'WRONG_LOCATION' ? { label: t('manager.booking.back'), onClick: () => navigate('/manager') } : { label: t('manager.booking.retry'), onClick: () => void q.refetch() }}
      />
    );
  }

  const d = q.data;
  const status = d.card.status;
  const waiting = status === 'CONFIRMED' && d.issueAct && !d.issueAct.clientConfirmedAt;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <div className="flex items-start justify-between gap-3">
          <h1 className="m-0 text-title-1 tabular">{d.card.code}</h1>
          <Badge tone={bookingStatusTone(status)}>{t(`manager.status.${status}`)}</Badge>
        </div>
        <p className="m-0 text-body text-ink-muted">
          {d.card.modelName} · <span className="tabular">{d.bike.plate}</span>
        </p>
        <dl className="m-0 mt-2 flex flex-col gap-1">
          <Row label={t('manager.booking.client')} value={d.client.name ?? t('manager.booking.noName')} />
          <Row label={t('manager.booking.period')} value={`${f.dateTime(d.card.startAt)} – ${f.dateTime(d.card.endAt)}`} />
        </dl>
        {d.client.phone && (
          <div>
            <a href={`tel:${d.client.phone}`} className="hit-44 inline-flex h-control-sm items-center gap-2 rounded-sm bg-surface px-3.5 text-caption font-bold text-ink">
              <Phone size={16} aria-hidden /> {t('manager.booking.call')} <span className="tabular">{d.client.phone}</span>
            </a>
          </div>
        )}
      </header>

      {cancelled && <p role="status" className="m-0 text-body-strong text-success">{t('manager.noShow.done')}</p>}
      {returned && (
        <Section title={t('manager.return.done')}>
          <dl className="m-0 flex flex-col gap-1">
            {returned.depositRefund > 0 && <Row strong label={t('manager.return.refundLabel')} value={f.money(returned.depositRefund)} />}
            {returned.lateFeeAmount > 0 && <Row strong label={t('manager.return.surchargeLabel')} value={f.money(returned.lateFeeAmount)} />}
          </dl>
        </Section>
      )}

      {status === 'CONFIRMED' && !d.issueAct && <IncidentBlock detail={d} />}
      {status === 'CONFIRMED' && <DocumentsBlock detail={d} actions={actions} />}
      {(status === 'CONFIRMED' || status === 'ISSUED' || (status === 'COMPLETED' && d.card.cashDue > 0)) && d.card.cashDue > 0 && <CashBlock key={`${d.paidAmount}-${status}`} detail={d} actions={actions} />}
      {status === 'CONFIRMED' && !d.issueAct && <HandoverForm detail={d} actions={actions} />}
      {waiting && <HandoverWaiting busy={q.isFetching} onRefresh={() => void q.refetch()} />}
      {status === 'ISSUED' && !returned && <ReturnForm detail={d} actions={actions} onDone={setReturned} />}
      {status === 'CONFIRMED' && !waiting && <NoShowBlock actions={actions} onDone={() => setCancelled(true)} />}
      {status !== 'CONFIRMED' && status !== 'ISSUED' && <Button variant="secondary" onClick={() => navigate('/manager')}>{t('manager.booking.back')}</Button>}
    </div>
  );
}
