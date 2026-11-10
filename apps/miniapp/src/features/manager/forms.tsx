import { useApp } from '@/app/context';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ExternalLink, Plus, Trash2 } from 'lucide-react';
import type { CashPaymentKind, DocumentDto, ManagerBookingDetail, ReturnResponse } from '@rental/shared';
import { Badge, Button, Chip, ChipGroup, Sheet, type BadgeTone } from '@rental/ui';
import { MainAction } from '@/app/shell/MainAction';
import { useManagerActions } from './api';
import { canSubmitHandover, canSubmitReturn, depositHeld, deductionsTotal, parseWhole, PHOTOS_MAX, PHOTOS_MIN } from './logic';
import { PhotoGrid, usePhotos } from './photos';
import { ErrorLine, FuelPicker, Row, Section, TextArea, TextInput, useFormat } from './ui';

type Actions = ReturnType<typeof useManagerActions>;

// ---------- Документы клиента ----------

const DOC_TONE: Record<DocumentDto['status'], BadgeTone> = { UPLOADED: 'warning', VERIFIED: 'success', REJECTED: 'danger' };

export function DocumentsBlock({ detail, actions }: { detail: ManagerBookingDetail; actions: Actions }) {
  const { t } = useTranslation();
  const f = useFormat();
  const { platform } = useApp();
  const [failed, setFailed] = useState(false);
  const open = async (id: string) => {
    try {
      platform.openLink(await actions.openDocument(id));
    } catch {
      setFailed(true);
    }
  };
  return (
    <Section title={t('manager.docs.title')} hint={t('manager.docs.hint')}>
      {detail.documents.length === 0 ? (
        <p className="m-0 text-body text-ink-muted">{t('manager.docs.empty')}</p>
      ) : (
        <ul className="m-0 flex list-none flex-col p-0">
          {detail.documents.map((d) => (
            <li key={d.id} className="flex flex-col gap-2 border-b border-line py-3 last:border-b-0">
              <div className="flex items-center justify-between gap-3">
                <span className="text-body-strong">{t(`manager.docs.type.${d.type}`)}</span>
                <Badge tone={DOC_TONE[d.status]}>{t(`manager.docs.state.${d.status}`)}</Badge>
              </div>
              {d.verifiedAt && <p className="m-0 text-caption text-ink-muted">{t('manager.docs.verifiedAt', { date: f.dateTime(d.verifiedAt) })}</p>}
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" icon={ExternalLink} onClick={() => void open(d.id)}>
                  {t('manager.docs.view')}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <ErrorLine error={failed ? new Error('x') : null} />
    </Section>
  );
}

// ---------- Выдача ----------

export function HandoverForm({ detail, actions }: { detail: ManagerBookingDetail; actions: Actions }) {
  const { t } = useTranslation();
  const id = detail.card.id;
  const [bikeId, setBikeId] = useState(detail.bike.id);
  const [mileage, setMileage] = useState(String(detail.bike.mileageKm));
  const [fuel, setFuel] = useState<number | null>(null);
  const [damages, setDamages] = useState('');
  const photos = usePhotos(id, PHOTOS_MAX);
  const draft = { bikeId, mileage, fuel, photoCount: photos.keys.length, uploading: photos.uploading };
  const ready = canSubmitHandover(draft);

  const submit = () => {
    const km = parseWhole(mileage);
    if (!ready || km === null || fuel === null) return;
    actions.handover.mutate({ bikeId, mileageKm: km, fuelLevel: fuel, photos: photos.keys, damages: damages.trim() || null });
  };

  return (
    <Section title={t('manager.handover.title')}>
      <div className="flex flex-col gap-1.5">
        <span className="text-body-strong">{t('manager.handover.bike')}</span>
        <ChipGroup label={t('manager.handover.bikeHint')}>
          {detail.freeBikes.map((b) => (
            <Chip
              key={b.id}
              variant="option"
              selected={b.id === bikeId}
              onClick={() => {
                setBikeId(b.id);
                setMileage(String(b.mileageKm));
              }}
            >
              <span className="tabular">{b.plate}</span>
            </Chip>
          ))}
        </ChipGroup>
        <p className="m-0 text-caption text-ink-muted">{t('manager.handover.bikeHint')}</p>
      </div>
      <TextInput label={t('manager.handover.mileage')} inputMode="numeric" autoComplete="off" value={mileage} onChange={(e) => setMileage(e.target.value)} />
      <FuelPicker label={t('manager.handover.fuel')} value={fuel} onChange={setFuel} />
      <div className="flex flex-col gap-1.5">
        <span className="text-body-strong">{t('manager.handover.photos')}</span>
        <p className="m-0 text-caption text-ink-muted">{t('manager.handover.photosHint', { min: PHOTOS_MIN, max: PHOTOS_MAX })}</p>
        <PhotoGrid photos={photos} max={PHOTOS_MAX} label={t('manager.handover.photos')} />
      </div>
      <TextArea label={t('manager.handover.damages')} hint={t('manager.handover.damagesHint')} value={damages} onChange={(e) => setDamages(e.target.value)} maxLength={1000} />
      {!ready && <p className="m-0 text-caption text-ink-muted">{t('manager.handover.notReady', { count: photos.keys.length, min: PHOTOS_MIN })}</p>}
      <ErrorLine error={actions.handover.error} />
      <MainAction text={t('manager.handover.submit')} onClick={submit} disabled={!ready} loading={actions.handover.isPending} />
    </Section>
  );
}

/** Акт выдачи создан, ждём подтверждения клиента (экран опрашивает сервер сам). */
export function HandoverWaiting({ onRefresh, busy }: { onRefresh: () => void; busy: boolean }) {
  const { t } = useTranslation();
  return (
    <Section title={t('manager.handover.sent')}>
      <p className="m-0 text-body text-ink-muted" role="status">
        {t('manager.handover.waiting')}
      </p>
      <Button variant="inverse" loading={busy} onClick={onRefresh}>
        {t('manager.handover.refresh')}
      </Button>
    </Section>
  );
}

// ---------- Возврат ----------

interface DeductionState {
  uid: number;
  amount: string;
  reason: string;
  keys: string[];
  uploading: boolean;
}

function DeductionRow({ bookingId, item, onChange, onRemove }: { bookingId: string; item: DeductionState; onChange: (p: Partial<DeductionState>) => void; onRemove: () => void }) {
  const { t } = useTranslation();
  const photos = usePhotos(bookingId, 4);
  const sig = photos.keys.join('|');
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  useEffect(() => {
    onChangeRef.current({ keys: photos.keys, uploading: photos.uploading });
  }, [sig, photos.uploading]);
  return (
    <li className="flex flex-col gap-3 border-b border-line pb-4 last:border-b-0">
      <TextInput label={t('manager.return.amount')} inputMode="numeric" autoComplete="off" value={item.amount} onChange={(e) => onChange({ amount: e.target.value })} />
      <TextInput label={t('manager.return.reason')} value={item.reason} maxLength={500} onChange={(e) => onChange({ reason: e.target.value })} />
      <div className="flex flex-col gap-1.5">
        <span className="text-body-strong">{t('manager.return.deductionPhotos')}</span>
        <PhotoGrid photos={photos} max={4} label={t('manager.return.deductionPhotos')} />
      </div>
      <Button size="sm" variant="ghost" icon={Trash2} iconPosition="start" onClick={onRemove}>
        {t('manager.return.removeDeduction')}
      </Button>
    </li>
  );
}

export function ReturnForm({ detail, actions, onDone }: { detail: ManagerBookingDetail; actions: Actions; onDone: (r: ReturnResponse) => void }) {
  const { t } = useTranslation();
  const f = useFormat();
  const id = detail.card.id;
  const [mileage, setMileage] = useState(String(detail.issueAct?.mileageKm ?? detail.bike.mileageKm));
  const [fuel, setFuel] = useState<number | null>(null);
  const [damages, setDamages] = useState('');
  const [rows, setRows] = useState<DeductionState[]>([]);
  const seq = useRef(0);
  const photos = usePhotos(id, PHOTOS_MAX);
  const held = depositHeld(detail.paidAmount, detail.totalAmount, detail.depositAmount);
  const deductions = rows.map((r) => ({ amount: r.amount, reason: r.reason, uploading: r.uploading }));
  const total = deductionsTotal(deductions);
  const ready = canSubmitReturn({ mileage, fuel, photoCount: photos.keys.length, uploading: photos.uploading, deductions, depositHeld: held });
  const issued = detail.issueAct?.mileageKm;
  const lower = issued !== undefined && parseWhole(mileage) !== null && (parseWhole(mileage) as number) < issued;

  const submit = () => {
    const km = parseWhole(mileage);
    if (!ready || km === null || fuel === null || lower) return;
    actions.returnBike.mutate(
      {
        mileageKm: km,
        fuelLevel: fuel,
        photos: photos.keys,
        damages: damages.trim() || null,
        deductions: rows.map((r) => ({ amount: parseWhole(r.amount) as number, reason: r.reason.trim(), photos: r.keys })),
      },
      { onSuccess: onDone },
    );
  };

  return (
    <Section title={t('manager.return.title')}>
      <div className="flex flex-col gap-1">
        <h3 className="m-0 text-body-strong">{t('manager.return.late')}</h3>
        <p className={detail.lateFee.amount > 0 ? 'm-0 text-body text-warning' : 'm-0 text-body text-ink-muted'}>
          {detail.lateFee.amount > 0 ? t('manager.return.lateFee', { minutes: detail.lateFee.minutesLate, amount: f.money(detail.lateFee.amount) }) : t('manager.return.lateNone')}
        </p>
      </div>
      <TextInput label={t('manager.return.mileage')} inputMode="numeric" autoComplete="off" value={mileage} onChange={(e) => setMileage(e.target.value)} />
      {lower && <p className="m-0 text-caption text-danger">{t('manager.return.mileageLower', { value: issued })}</p>}
      <FuelPicker label={t('manager.return.fuel')} value={fuel} onChange={setFuel} />
      <div className="flex flex-col gap-1.5">
        <span className="text-body-strong">{t('manager.return.photos')}</span>
        <p className="m-0 text-caption text-ink-muted">{t('manager.handover.photosHint', { min: PHOTOS_MIN, max: PHOTOS_MAX })}</p>
        <PhotoGrid photos={photos} max={PHOTOS_MAX} label={t('manager.return.photos')} />
      </div>
      <TextArea label={t('manager.return.damages')} hint={t('manager.return.damagesHint')} value={damages} onChange={(e) => setDamages(e.target.value)} maxLength={1000} />

      <div className="flex flex-col gap-3">
        <h3 className="m-0 text-body-strong">{t('manager.return.deductions')}</h3>
        {rows.length > 0 && (
          <ul className="m-0 flex list-none flex-col gap-4 p-0">
            {rows.map((r) => (
              <DeductionRow
                key={r.uid}
                bookingId={id}
                item={r}
                onChange={(p) => setRows((list) => list.map((x) => (x.uid === r.uid ? { ...x, ...p } : x)))}
                onRemove={() => setRows((list) => list.filter((x) => x.uid !== r.uid))}
              />
            ))}
          </ul>
        )}
        <div>
          <Button size="sm" variant="secondary" icon={Plus} iconPosition="start" onClick={() => setRows((list) => [...list, { uid: seq.current++, amount: '', reason: '', keys: [], uploading: false }])}>
            {t('manager.return.addDeduction')}
          </Button>
        </div>
        {total > 0 && (
          <dl className="m-0 flex flex-col gap-1">
            <Row label={t('manager.sum.deducted')} value={f.money(total)} />
          </dl>
        )}
        {total > held && <p className="m-0 text-caption text-danger">{t('manager.return.exceeds', { amount: f.money(held) })}</p>}
      </div>
      <ErrorLine error={actions.returnBike.error} />
      <MainAction text={t('manager.return.submit')} onClick={submit} disabled={!ready || lower} loading={actions.returnBike.isPending} />
    </Section>
  );
}

// ---------- Наличные ----------

const KINDS: CashPaymentKind[] = ['RENT', 'DEPOSIT', 'PREPAYMENT', 'SURCHARGE'];

function defaultKind(d: ManagerBookingDetail): CashPaymentKind {
  if (d.card.status === 'COMPLETED') return 'SURCHARGE';
  if (d.paidAmount >= d.totalAmount && d.depositAmount > 0) return 'DEPOSIT';
  return 'RENT';
}

export function CashBlock({ detail, actions }: { detail: ManagerBookingDetail; actions: Actions }) {
  const { t } = useTranslation();
  const f = useFormat();
  const [amount, setAmount] = useState(String(detail.card.cashDue));
  const [kind, setKind] = useState<CashPaymentKind>(defaultKind(detail));
  const [received, setReceived] = useState<number | null>(null);
  const value = parseWhole(amount);
  const submit = () => {
    if (!value) return;
    actions.cash.mutate({ amount: value, kind }, { onSuccess: () => setReceived(value) });
  };
  return (
    <Section title={t('manager.cash.title')}>
      <dl className="m-0 flex flex-col gap-1">
        <Row label={t('manager.sum.total')} value={f.money(detail.totalAmount)} />
        <Row label={t('manager.sum.deposit')} value={f.money(detail.depositAmount)} />
        <Row label={t('manager.sum.paid')} value={f.money(detail.paidAmount)} />
        <Row strong label={t('manager.sum.cashDue')} value={f.money(detail.card.cashDue)} />
      </dl>
      <ChipGroup label={t('manager.cash.kind')}>
        {KINDS.map((k) => (
          <Chip key={k} selected={k === kind} onClick={() => setKind(k)}>
            {t(`manager.cash.kinds.${k}`)}
          </Chip>
        ))}
      </ChipGroup>
      <TextInput label={t('manager.cash.amount')} inputMode="numeric" autoComplete="off" value={amount} onChange={(e) => setAmount(e.target.value)} />
      {received !== null && !actions.cash.error && <p role="status" className="m-0 text-body text-success">{t('manager.cash.done', { amount: f.money(received) })}</p>}
      <ErrorLine error={actions.cash.error} />
      <Button variant="inverse" disabled={!value} loading={actions.cash.isPending} onClick={submit}>
        {t('manager.cash.submit')}
      </Button>
    </Section>
  );
}

// ---------- Неявка ----------

export function NoShowBlock({ actions, onDone }: { actions: Actions; onDone: () => void }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        {t('manager.noShow.button')}
      </Button>
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title={t('manager.noShow.title')}
        closeLabel={t('manager.bikes.close')}
        footer={
          <div className="flex flex-col gap-2">
            <ErrorLine error={actions.noShow.error} />
            <Button size="lg" variant="inverse" block loading={actions.noShow.isPending} onClick={() => actions.noShow.mutate(undefined, { onSuccess: () => { setOpen(false); onDone(); } })}>
              {t('manager.noShow.confirm')}
            </Button>
            <Button variant="ghost" block onClick={() => setOpen(false)}>
              {t('manager.noShow.cancel')}
            </Button>
          </div>
        }
      >
        <p className="m-0 text-body text-ink-muted">{t('manager.noShow.text')}</p>
      </Sheet>
    </>
  );
}
