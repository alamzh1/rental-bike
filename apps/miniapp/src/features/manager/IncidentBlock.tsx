import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { ManagerBookingDetail } from '@rental/shared';
import { Button, Sheet } from '@rental/ui';
import { useApp } from '@/app/context';
import { errorCode, errorKey } from '../checkout/errors';
import { Section, useFormat } from './ui';

/** Байка нет на месте: тот же номер модели — в форме выдачи ниже; другая модель, «байк на месте» или отмена — здесь. */
export function IncidentBlock({ detail: d }: { detail: ManagerBookingDetail }) {
  const { t } = useTranslation();
  const f = useFormat();
  const { api } = useApp();
  const qc = useQueryClient();
  const [bikeId, setBikeId] = useState('');
  const [confirm, setConfirm] = useState(false);
  const act = useMutation({
    mutationFn: (v: { path: string; json?: unknown }) => api.request<void>(`/manager/bookings/${d.card.id}/incident${v.path}`, { method: 'POST', ...(v.json ? { json: v.json } : {}) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['manager'] }),
  });
  const error = act.isError ? <p role="alert" className="m-0 text-caption text-danger">{t(errorKey(errorCode(act.error)))}</p> : null;
  const sameModel = d.freeBikes.filter((b) => b.id !== d.bike.id);

  if (!d.incident) {
    return (
      <>
        <Button variant="secondary" loading={act.isPending} onClick={() => act.mutate({ path: '' })}>
          {t('manager.incident.report')}
        </Button>
        {error}
      </>
    );
  }
  return (
    <Section title={t('manager.incident.title')}>
      <div className="flex flex-col gap-3">
        <p className="m-0 text-body">{t(`manager.incident.source.${d.incident.source}`)}</p>
        {d.incident.comment && <p className="m-0 text-body text-ink-muted">{d.incident.comment}</p>}
        <p className="m-0 text-body-strong">{sameModel.length > 0 ? t('manager.incident.sameModel', { count: sameModel.length }) : t('manager.incident.noSameModel')}</p>
        {d.incident.proposal ? (
          <p role="status" className="m-0 text-body">{t('manager.incident.proposed', { model: d.incident.proposal.modelName, plate: d.incident.proposal.plate })}</p>
        ) : d.replacements.length > 0 ? (
          <div className="flex flex-col gap-2">
            <label className="flex flex-col gap-1">
              <span className="text-caption font-semibold text-ink-muted">{t('manager.incident.replacement')}</span>
              <select value={bikeId} onChange={(e) => setBikeId(e.target.value)} className="h-control-md w-full rounded-md border border-line-strong bg-bg px-3 text-body text-ink">
                <option value="">{t('manager.incident.choose')}</option>
                {d.replacements.map((r) => (
                  <option key={r.bikeId} value={r.bikeId}>
                    {r.modelName} · {r.plate}{r.refund > 0 ? ` · ${t('manager.incident.refund', { amount: f.money(r.refund) })}` : ''}
                  </option>
                ))}
              </select>
            </label>
            <p className="m-0 text-caption text-ink-muted">{t('manager.incident.terms')}</p>
            <Button disabled={!bikeId} loading={act.isPending} onClick={() => act.mutate({ path: '/propose', json: { bikeId } })}>
              {t('manager.incident.propose')}
            </Button>
          </div>
        ) : (
          <p className="m-0 text-body text-ink-muted">{t('manager.incident.noReplacement')}</p>
        )}
        <Button variant="secondary" loading={act.isPending} onClick={() => act.mutate({ path: '/dismiss' })}>
          {t('manager.incident.present')}
        </Button>
        <Button variant="ghost" className="text-danger" onClick={() => setConfirm(true)}>
          {t('manager.incident.cancel')}
        </Button>
        {error}
      </div>
      <Sheet
        open={confirm}
        onClose={() => setConfirm(false)}
        title={t('manager.incident.cancel')}
        closeLabel={t('manager.bikes.close')}
        footer={
          <Button size="lg" variant="inverse" block loading={act.isPending} onClick={() => act.mutate({ path: '/cancel' }, { onSettled: () => setConfirm(false) })}>
            {t('manager.incident.cancel')}
          </Button>
        }
      >
        <p className="m-0 pb-2 text-body">{t('manager.incident.cancelConfirm')}</p>
      </Sheet>
    </Section>
  );
}
