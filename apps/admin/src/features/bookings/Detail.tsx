import { useState, type ReactNode } from 'react';
import { useInvalidate, useOne, useUpdate } from '@refinedev/core';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, CircleAlert, ExternalLink, Image as ImageIcon } from 'lucide-react';
import { canSeeMoney, type AdminActPhotos, type AdminBookingDetail, type BookingStatus, type DocumentUrlResponse } from '@rental/shared';
import { Badge, bookingStatusTone, Button, EmptyState, Icon, Skeleton } from '@rental/ui';
import { api } from '@/app/providers';
import { Alert, DataTable, Field, inputClass, PageHeader, Panel, td, th, useErrorText, useFormat, useMe, useToast } from '@/app/ui';

/** Карточка брони: сводка, смена статуса, история, платежи, документы и фотоакты по временным ссылкам. */
export default function BookingDetail() {
  const me = useMe();
  const { id = '' } = useParams();
  const { t } = useTranslation();
  const f = useFormat();
  const toast = useToast();
  const errorText = useErrorText();
  const invalidate = useInvalidate();
  const { data, isLoading, isError, refetch } = useOne<AdminBookingDetail>({ resource: 'bookings', id });
  const { mutate: update, isLoading: saving } = useUpdate<AdminBookingDetail>();
  const [next, setNext] = useState<BookingStatus | ''>('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [photos, setPhotos] = useState<Record<string, AdminActPhotos['photos']>>({});
  const b = data?.data;

  if (isError) return <EmptyState icon={CircleAlert} tone="danger" title={t('admin.common.errorTitle')} action={{ label: t('admin.common.retry'), onClick: () => void refetch() }} className="py-16" />;
  if (isLoading || !b)
    return (
      <div aria-busy="true" className="flex flex-col gap-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40" />
        <Skeleton className="h-40" />
      </div>
    );

  const incidentAction = async (action: 'dismiss' | 'cancel') => {
    setError(null);
    try {
      await api.post(`/admin/bookings/${id}/incident/${action}`);
      toast('success', t('admin.booking.statusChanged'));
      void invalidate({ resource: 'bookings', invalidates: ['list', 'detail'], id });
    } catch (e) {
      setError(errorText(e));
    }
  };

  const changeStatus = () => {
    if (!next) return;
    setError(null);
    update(
      { resource: 'bookings', id, values: { status: next, reason: reason || undefined }, successNotification: false, errorNotification: false },
      {
        onSuccess: () => {
          setNext('');
          setReason('');
          toast('success', t('admin.booking.statusChanged'));
          void invalidate({ resource: 'bookings', invalidates: ['list', 'detail'], id });
        },
        onError: (e) => setError(errorText(e)),
      },
    );
  };

  const openDocument = async (documentId: string) => {
    // Окно открываем сразу (в обработчике клика), адрес подставляем после ответа — иначе браузер заблокирует всплывающее окно
    const w = window.open('', '_blank');
    if (w) w.opener = null;
    try {
      const r = await api.get<DocumentUrlResponse>(`/admin/bookings/${id}/documents/${documentId}/url`);
      if (w) w.location.href = r.url;
      else window.location.assign(r.url);
    } catch (e) {
      w?.close();
      setError(errorText(e));
    }
  };

  const loadPhotos = async (actId: string) => {
    try {
      const r = await api.get<AdminActPhotos>(`/admin/bookings/${id}/acts/${actId}/photos`);
      setPhotos((p) => ({ ...p, [actId]: r.photos }));
    } catch (e) {
      setError(errorText(e));
    }
  };

  const facts: [string, ReactNode][] = [
    [t('admin.booking.client'), <>{b.client.name}{b.client.walkIn && <Badge plain className="ml-2">{t('admin.bookings.walkIn')}</Badge>}</>],
    [t('admin.booking.phone'), b.client.phone ? <a href={`tel:${b.client.phone}`} className="text-accent-text tabular">{b.client.phone}</a> : t('admin.common.none')],
    [t('admin.booking.bike'), <>{b.modelName} <span className="text-ink-muted tabular">{b.bikePlate}</span></>],
    [t('admin.booking.period'), <span className="tabular">{f.dateTime(b.startAt)} → {f.dateTime(b.endAt)}</span>],
    [t('admin.booking.payment'), t(`admin.booking.method.${b.paymentMethod}`)],
    ...(canSeeMoney(me.role)
      ? ([
          [t('admin.booking.total'), <span className="tabular">{f.money(b.totalAmount)}</span>],
          [t('admin.booking.deposit'), <span className="tabular">{f.money(b.depositAmount)}</span>],
          [t('admin.booking.paid'), <span className="tabular">{f.money(b.paidAmount)}</span>],
        ] as [string, React.ReactNode][])
      : []),
  ];

  return (
    <>
      <Link to="/bookings" className="mb-3 inline-flex h-control-sm items-center gap-1 text-caption font-bold text-accent-text">
        <Icon icon={ArrowLeft} size={16} />
        {t('admin.booking.back')}
      </Link>
      <PageHeader title={t('admin.booking.title', { code: b.code })} actions={<Badge tone={bookingStatusTone(b.status)}>{t(`admin.status.${b.status}`)}</Badge>} />
      {error && (
        <div className="mb-4">
          <Alert onClose={() => setError(null)} closeLabel={t('admin.common.close')}>
            {error}
          </Alert>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="flex flex-col gap-6">
          <Panel>
            <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
              {facts.map(([k, v]) => (
                <div key={k}>
                  <dt className="text-caption text-ink-muted">{k}</dt>
                  <dd className="text-body">{v}</dd>
                </div>
              ))}
            </dl>
          </Panel>

          {canSeeMoney(me.role) && <Panel title={t('admin.booking.payments')}>
            {b.payments.length === 0 ? (
              <p className="text-body text-ink-muted">{t('admin.booking.noPayments')}</p>
            ) : (
              <DataTable
                label={t('admin.booking.payments')}
                head={
                  <>
                    <th className={th}>{t('admin.audit.col.at')}</th>
                    <th className={th}>{t('admin.booking.payment')}</th>
                    <th className={th}>{t('admin.booking.status')}</th>
                    <th className={`${th} text-right`}>{t('admin.bookings.col.amount')}</th>
                  </>
                }
              >
                {b.payments.map((p) => {
                  const mismatch = p.receivedAmount !== null && p.receivedAmount !== p.amount;
                  return (
                    <tr key={p.id}>
                      <td className={`${td} whitespace-nowrap tabular`}>{f.dateTime(p.paidAt ?? p.createdAt)}</td>
                      <td className={td}>
                        {t(`admin.booking.paymentKind.${p.kind}`)} · {t(`admin.booking.method.${p.method}`)}
                      </td>
                      <td className={td}>
                        <Badge tone={p.status === 'PAID' ? 'success' : p.status === 'PENDING' ? 'warning' : 'neutral'}>{t(`admin.booking.paymentStatus.${p.status}`)}</Badge>
                      </td>
                      <td className={`${td} whitespace-nowrap text-right tabular`}>
                        {f.money(p.amount)}
                        {mismatch && <span className="block text-caption text-danger">{t('admin.booking.received', { amount: f.money(p.receivedAmount!) })}</span>}
                      </td>
                    </tr>
                  );
                })}
              </DataTable>
            )}
          </Panel>}

          <Panel title={t('admin.booking.acts')}>
            {b.acts.length === 0 ? (
              <p className="text-body text-ink-muted">{t('admin.booking.noActs')}</p>
            ) : (
              <ul className="flex flex-col gap-4">
                {b.acts.map((a) => (
                  <li key={a.id} className="border-b border-line pb-4 last:border-0 last:pb-0">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <h3 className="text-body-strong">{t(`admin.booking.actKind.${a.kind}`)}</h3>
                      <span className="text-caption text-ink-muted tabular">{f.dateTime(a.createdAt)}</span>
                    </div>
                    <p className="text-body tabular">{t('admin.booking.actLine', { km: a.mileageKm, fuel: a.fuelLevel })}</p>
                    {a.damages && <p className="text-body">{t('admin.booking.damages', { text: a.damages })}</p>}
                    <p className="text-caption text-ink-muted">
                      {a.managerName && t('admin.booking.actBy', { name: a.managerName })}
                      {a.clientConfirmedAt && ` · ${t('admin.booking.clientConfirmed')}`}
                    </p>
                    {a.photoCount > 0 &&
                      (photos[a.id] ? (
                        <ul className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
                          {photos[a.id]!.map((p, i) => (
                            <li key={p.url}>
                              <a href={p.url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-xs bg-surface">
                                <img src={p.url} alt={`${t(`admin.booking.actKind.${a.kind}`)} ${i + 1}`} className="aspect-square w-full object-cover" loading="lazy" />
                              </a>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <Button variant="secondary" size="sm" icon={ImageIcon} iconPosition="start" className="mt-2" onClick={() => void loadPhotos(a.id)}>
                          {t('admin.booking.showPhotos', { count: a.photoCount })}
                        </Button>
                      ))}
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <div className="flex flex-col gap-6">
          {b.incidents.length > 0 && (
            <Panel title={t('admin.incident.title')}>
              <ul className="flex flex-col gap-3">
                {b.incidents.map((i) => (
                  <li key={i.id} className="flex flex-col gap-1">
                    <span className="text-body-strong">{t(i.status === 'OPEN' ? 'admin.incident.open' : `admin.incident.resolution.${i.resolution}`)}</span>
                    <span className="text-caption text-ink-muted tabular">{f.dateTime(i.createdAt)} · {t(`admin.incident.source.${i.source}`)}{i.escalated ? ` · ${t('admin.owners.noAnswer')}` : ''}</span>
                    {i.comment && <span className="text-body">{i.comment}</span>}
                    {i.status === 'OPEN' && (
                      <span className="mt-1 flex flex-wrap gap-2">
                        <Button size="sm" variant="secondary" loading={saving} onClick={() => void incidentAction('dismiss')}>{t('admin.incident.present')}</Button>
                        <Button size="sm" variant="inverse" loading={saving} onClick={() => window.confirm(t('admin.incident.cancelConfirm')) && void incidentAction('cancel')}>{t('admin.incident.cancel')}</Button>
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </Panel>
          )}

          <Panel title={t('admin.booking.changeStatus')}>
            {b.nextStatuses.length === 0 ? (
              <p className="text-body text-ink-muted">{t('admin.booking.noNextStatus')}</p>
            ) : (
              <div className="flex flex-col gap-3">
                <Field label={t('admin.booking.newStatus')} htmlFor="next-status">
                  <select id="next-status" value={next} onChange={(e) => setNext(e.target.value as BookingStatus)} className={inputClass}>
                    <option value="">{t('admin.common.none')}</option>
                    {b.nextStatuses.map((s) => (
                      <option key={s} value={s}>
                        {t(`admin.status.${s}`)}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label={t('admin.booking.reason')} htmlFor="reason">
                  <input id="reason" value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} className={inputClass} />
                </Field>
                <Button variant="inverse" disabled={!next} loading={saving} onClick={changeStatus}>
                  {t('admin.booking.applyStatus')}
                </Button>
              </div>
            )}
          </Panel>

          <Panel title={t('admin.booking.history')}>
            {b.history.length === 0 ? (
              <p className="text-body text-ink-muted">{t('admin.booking.noHistory')}</p>
            ) : (
              <ol className="flex flex-col gap-3">
                {b.history.map((h) => (
                  <li key={h.id} className="flex flex-col">
                    <span className="flex flex-wrap items-center gap-2">
                      <Badge tone={bookingStatusTone(h.to)}>{t(`admin.status.${h.to}`)}</Badge>
                      <span className="text-caption text-ink-muted tabular">{f.dateTime(h.at)}</span>
                    </span>
                    <span className="mt-0.5 text-caption text-ink-muted">
                      {h.actorName ?? t('admin.booking.system')}
                      {h.reason && ` · ${h.reason}`}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </Panel>

          <Panel title={t('admin.booking.documents')}>
            {b.documents.length === 0 ? (
              <p className="text-body text-ink-muted">{t('admin.booking.noDocuments')}</p>
            ) : (
              <>
                <ul className="flex flex-col">
                  {b.documents.map((d) => (
                    <li key={d.id} className="flex items-center justify-between gap-3 border-b border-line py-2 last:border-0">
                      <span className="min-w-0">
                        <span className="text-body">{t(`admin.booking.docType.${d.type}`)}</span>
                        <span className="block text-caption text-ink-muted">
                          {t(`admin.booking.docStatus.${d.status}`)} · {f.date(d.createdAt)}
                        </span>
                      </span>
                      <Button variant="secondary" size="sm" icon={ExternalLink} onClick={() => void openDocument(d.id)}>
                        {t('admin.booking.openDocument')}
                      </Button>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-caption text-ink-muted">{t('admin.booking.linkTtl')}</p>
              </>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}
