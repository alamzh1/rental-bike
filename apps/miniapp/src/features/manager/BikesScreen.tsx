import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Wrench } from 'lucide-react';
import { fromLocationDateTime } from '@rental/shared';
import type { ManagerBike } from '@rental/shared';
import { Badge, Button, EmptyState, Sheet, Skeleton, useDelayedFlag } from '@rental/ui';
import { useManagerBikes, useManagerTimezone, usePatchBike } from './api';
import { ErrorLine, TextInput, useFormat } from './ui';

/** Парк точки: перевод байка в «Ремонт» с датой готовности (байк исчезает из доступности) и возврат в строй. */
export function BikesScreen() {
  const { t } = useTranslation();
  const f = useFormat();
  const tz = useManagerTimezone();
  const bikes = useManagerBikes();
  const patch = usePatchBike();
  const [target, setTarget] = useState<ManagerBike | null>(null);
  const [date, setDate] = useState('');
  const skeleton = useDelayedFlag(bikes.isPending);

  const close = () => {
    setTarget(null);
    setDate('');
    patch.reset();
  };
  const save = () => {
    if (!target) return;
    patch.mutate({ id: target.id, status: 'REPAIR', readyAt: date ? fromLocationDateTime(date, '08:00', tz).toISOString() : null }, { onSuccess: close });
  };

  return (
    <div className="flex flex-col gap-4">
      <h2 className="m-0 text-title-2">{t('manager.bikes.title')}</h2>
      {bikes.isPending && <div aria-busy="true" className="flex flex-col gap-3">{skeleton && [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-14" />)}</div>}
      {bikes.isError && <EmptyState tone="danger" icon={Wrench} title={t('errors.UNKNOWN')} action={{ label: t('manager.booking.retry'), onClick: () => void bikes.refetch() }} />}
      {bikes.data?.length === 0 && <p className="m-0 text-body text-ink-muted">{t('manager.bikes.empty')}</p>}
      <ul className="m-0 flex list-none flex-col p-0">
        {bikes.data?.map((b) => (
          <li key={b.id} className="flex items-center gap-3 border-b border-line py-3">
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-body-strong tabular">{b.plate}</span>
              <span className="truncate text-body text-ink-muted">
                {b.modelName} · <span className="tabular">{t('manager.bikes.mileage', { value: b.mileageKm })}</span>
              </span>
              {b.status === 'REPAIR' && <span className="text-caption text-warning">{b.readyAt ? t('manager.bikes.readyUntil', { date: f.date(b.readyAt) }) : t('manager.bikes.readyNone')}</span>}
            </span>
            <Badge tone={b.status === 'REPAIR' ? 'warning' : 'success'}>{t(`manager.bikes.status.${b.status}`)}</Badge>
            {b.status === 'REPAIR' ? (
              <Button size="sm" variant="secondary" loading={patch.isPending && patch.variables?.id === b.id} onClick={() => patch.mutate({ id: b.id, status: 'ACTIVE' })}>
                {t('manager.bikes.toActive')}
              </Button>
            ) : (
              <Button size="sm" variant="secondary" onClick={() => setTarget(b)}>
                {t('manager.bikes.toRepair')}
              </Button>
            )}
          </li>
        ))}
      </ul>
      <ErrorLine error={target ? null : patch.error} />
      <Sheet
        open={!!target}
        onClose={close}
        title={t('manager.bikes.sheetTitle', { plate: target?.plate ?? '' })}
        closeLabel={t('manager.bikes.close')}
        footer={
          <Button size="lg" variant="inverse" block loading={patch.isPending} onClick={save}>
            {t('manager.bikes.save')}
          </Button>
        }
      >
        <div className="flex flex-col gap-3">
          <p className="m-0 text-body text-ink-muted">{t('manager.bikes.sheetHint')}</p>
          <TextInput type="date" label={t('manager.bikes.readyAt')} value={date} onChange={(e) => setDate(e.target.value)} />
          <ErrorLine error={patch.error} />
        </div>
      </Sheet>
    </div>
  );
}
