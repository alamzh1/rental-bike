import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Banknote, CalendarDays, Landmark, RussianRuble, Minus, PackageSearch, Plus, Store, Truck, UserRound } from 'lucide-react';
import { Button, Chip, ChipGroup, EmptyState, Icon, IconButton, Skeleton } from '@rental/ui';
import { formatDate, formatPrice, formatTime, pickText } from '@rental/i18n';
import type { Booking, Lang, LicenseCategory, ModelDetail, PaymentMethod, Quote } from '@rental/shared';
import { licenseAllows, rentalDays, vndToRub } from '@rental/shared';
import { useApp, useHaptic } from '@/app/context';
import { MainAction } from '@/app/shell/MainAction';
import { paths } from '@/app/router';
import { useBookings } from '../bookings/api';
import { DocumentSlots, useDocumentsState } from '../documents/DocumentSlots';
import { useDates } from '../dates/store';
import { formatRub } from '../payment/rub';
import { RulesSheet } from '../profile/RulesSheet';
import { useDisplayCurrency, usePublicSettings } from '../profile/settings';
import { clearDraft, readDraft, writeDraft } from './draft';
import { Breakdown } from './Breakdown';
import { requestTelegramContact } from './contact';
import { errorCode, errorKey, quoteErrorAction } from './errors';
import { Field } from './Field';
import { parsePhone } from './phone';
import { blockedReason, buildBookingRequest } from './request';
import type { LatLng } from './DeliveryMap';

// Карта (Leaflet) грузится отдельным чанком, только когда выбрана доставка.
const DeliveryMap = lazy(() => import('./DeliveryMap'));

const LICENSES: LicenseCategory[] = ['A1', 'A', 'NONE'];

/** Оформление на одном экране: получение, опции, контакт, права и документы, согласие, сумма, способ оплаты. */
export default function CheckoutScreen() {
  const { modelId = '' } = useParams();
  const { t, i18n } = useTranslation();
  const lang = i18n.language as Lang;
  const navigate = useNavigate();
  const haptic = useHaptic();
  const { api, user, updateMe } = useApp();
  const queryClient = useQueryClient();
  const { range, link } = useDates();
  const display = useDisplayCurrency();
  const publicSettings = usePublicSettings().data;
  const prepayPercent = publicSettings?.cashPrepayPercent ?? 0;
  const rubPerVnd = publicSettings?.rubTransfer?.rubPerVnd ?? null;
  const bookings = useBookings();

  // Черновик переживает переход к документам и обратно
  const [draft] = useState(() => readDraft(modelId));
  const [delivery, setDelivery] = useState(draft?.delivery ?? false);
  const [address, setAddress] = useState(draft?.address ?? '');
  const [pin, setPin] = useState<LatLng | null>(draft?.pin ?? null);
  const [extras, setExtras] = useState<Record<string, number>>(draft?.extras ?? {});
  const [phoneInput, setPhoneInput] = useState<string | null>(draft?.phoneInput ?? null);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [contactNote, setContactNote] = useState<'sent' | null>(null);
  const [methodChoice, setMethodChoice] = useState<PaymentMethod | null>(draft?.methodChoice ?? null);
  const [agreed, setAgreed] = useState(draft?.agreed ?? false);
  useEffect(() => {
    writeDraft(modelId, { delivery, address, pin, extras, phoneInput, methodChoice, agreed });
  }, [modelId, delivery, address, pin, extras, phoneInput, methodChoice, agreed]);
  const [attempted, setAttempted] = useState(false);

  const model = useQuery({
    queryKey: ['checkout-model', modelId, range?.from, range?.to],
    queryFn: () => api.request<ModelDetail>(`/models/${modelId}?from=${encodeURIComponent(range!.from)}&to=${encodeURIComponent(range!.to)}`),
    enabled: !!range,
  });
  const documents = useDocumentsState();

  const quoteExtras = useMemo(
    () => Object.entries(extras).filter(([, qty]) => qty > 0).map(([id, qty]) => ({ id, qty })),
    [extras],
  );
  const quote = useQuery({
    queryKey: ['checkout-quote', modelId, range?.from, range?.to, quoteExtras, delivery],
    queryFn: () => api.request<Quote>('/quotes', { method: 'POST', json: { modelId, startAt: range!.from, endAt: range!.to, extras: quoteExtras, delivery } }),
    enabled: !!range,
    placeholderData: (prev) => prev,
  });

  // Повторный клиент: способ оплаты — как в прошлой брони, телефон — из профиля.
  const lastMethod = bookings.data?.items[0]?.paymentMethod;
  // Рубли предлагаются первыми тому, кто смотрит цены в рублях; выключенный способ не выбирается даже из черновика
  const wanted: PaymentMethod = methodChoice ?? lastMethod ?? (user.currency === 'RUB' ? 'RUB_TRANSFER' : 'VIETQR');
  const method: PaymentMethod = wanted === 'RUB_TRANSFER' && !rubPerVnd ? 'VIETQR' : wanted;
  const phone = phoneInput ?? user.phone ?? '';
  const phoneState = parsePhone(phone);

  const create = useMutation({
    mutationFn: (body: ReturnType<typeof buildBookingRequest>) => api.request<Booking>('/bookings', { method: 'POST', json: body }),
    onSuccess: (booking) => {
      haptic.notification('success');
      clearDraft(modelId);
      void queryClient.invalidateQueries({ queryKey: ['bookings'] });
      if (phoneState.ok && phoneState.e164 !== user.phone) void updateMe({ phone: phoneState.e164 }).catch(() => undefined);
      navigate(paths.payment(booking.id), { replace: true });
    },
    onError: (e) => {
      haptic.notification('error');
      // Файл могли не дозагрузить: клиент увидит, какого документа на самом деле нет
      if (errorCode(e) === 'DOCUMENTS_REQUIRED') void queryClient.invalidateQueries({ queryKey: ['documents'] });
    },
  });

  if (!range) {
    return (
      <EmptyState
        icon={CalendarDays}
        title={t('checkout.noDates.title')}
        text={t('checkout.noDates.text')}
        action={{ label: t('checkout.noDates.action'), onClick: () => navigate(link(paths.dates, new URLSearchParams({ model: modelId }))) }}
        className="mt-8"
      />
    );
  }
  if (model.isError || quote.isError) {
    const code = errorCode(model.error ?? quote.error);
    // MIN_RENT_DAYS / LEAD_TIME от POST /quotes — даты не проходят правила, повтор не поможет.
    const toDates = !model.isError && quoteErrorAction(code) === 'dates';
    return (
      <EmptyState
        tone="danger"
        icon={PackageSearch}
        title={t('checkout.error.title')}
        text={t(errorKey(code))}
        action={
          toDates
            ? { label: t('checkout.taken.dates'), onClick: () => navigate(link(paths.dates, new URLSearchParams({ model: modelId }))) }
            : { label: t('common.actions.retry'), onClick: () => { void model.refetch(); void quote.refetch(); } }
        }
        className="mt-8"
      />
    );
  }
  if (!model.data || !quote.data) return <CheckoutSkeleton />;

  const m = model.data;
  const q = quote.data;
  const tz = m.location.timezone;
  const from = new Date(range.from);
  const to = new Date(range.to);
  const canDeliver = m.deliveryFee !== null;
  const state = { modelId, range, extras, method, phone, agreed, delivery, address, ...(pin ? { pin } : {}) };
  const license = user.licenseCategory;
  const licenseOk = licenseAllows(m, license);
  const blocked = blockedReason({ ...state, documentsReady: documents.ready, licenseOk });
  const taken = create.isError && errorCode(create.error) === 'BIKE_TAKEN';
  const point: LatLng = { lat: m.location.lat, lng: m.location.lng };

  const submit = () => {
    setAttempted(true);
    setPhoneTouched(true);
    if (blocked || create.isPending) return;
    create.mutate(buildBookingRequest(state));
  };

  const shareContact = async () => {
    haptic.selection();
    const res = await requestTelegramContact();
    if (res.status === 'sent') {
      if (res.phone) setPhoneInput(res.phone);
      else setContactNote('sent');
    }
  };

  if (taken) {
    return (
      <div className="flex flex-col gap-4 px-4 pt-8">
        <div className="grid h-18 w-18 place-items-center rounded-full bg-danger-soft text-danger">
          <Icon icon={AlertTriangle} size={24} />
        </div>
        <h1 className="m-0 text-title-1 text-balance" role="alert">{t('errors.BIKE_TAKEN')}</h1>
        <p className="m-0 text-body text-ink-muted">{t('checkout.taken.text')}</p>
        <div className="flex flex-col gap-2">
          <Button block size="lg" onClick={() => navigate(link(paths.catalog))}>
            {t('checkout.taken.other')}
          </Button>
          <Button block variant="secondary" onClick={() => navigate(link(paths.dates, new URLSearchParams({ model: modelId })))}>
            {t('checkout.taken.dates')}
          </Button>
        </div>
      </div>
    );
  }

  const prepayAmount = Math.round((q.total * prepayPercent) / 100);
  const ctaText = method === 'RUB_TRANSFER' && rubPerVnd ? t('checkout.cta.pay', { amount: formatRub(vndToRub(q.total, rubPerVnd), lang) }) : method === 'VIETQR' ? t('checkout.cta.pay', { amount: formatPrice(q.payable, lang, display) }) : prepayPercent > 0 ? t('checkout.cta.pay', { amount: formatPrice(prepayAmount, lang, display) }) : t('checkout.cta.book');
  const reasonText = blocked ? t(`checkout.blocked.${blocked}`) : null;
  const phoneError = (phoneTouched || attempted) && !phoneState.ok ? t(phone.trim() ? 'checkout.contact.invalid' : 'checkout.contact.required') : null;
  const otherError = create.isError && !taken ? t(errorKey(errorCode(create.error))) : null;

  return (
    <div className="flex flex-col gap-6 px-4 pt-2">
      <header className="flex flex-col gap-1">
        <h1 className="m-0 text-title-1 text-balance">{t('checkout.title')}</h1>
        <p className="m-0 text-body text-ink-muted">{m.name}</p>
        <button
          type="button"
          onClick={() => navigate(link(paths.dates, new URLSearchParams({ model: modelId })))}
          className="tabular mt-2 flex min-h-control-md items-center gap-3 rounded-md bg-surface px-4 py-2 text-left"
        >
          <Icon icon={CalendarDays} size={20} className="text-ink-muted" />
          <span className="flex-1 text-body-strong">
            {formatDate(from, lang, tz)} {formatTime(from, lang, tz)} — {formatDate(to, lang, tz)} {formatTime(to, lang, tz)}
          </span>
          <span className="text-caption text-accent-text">{t('checkout.changeDates')}</span>
        </button>
        <p className="m-0 text-caption text-ink-muted">{t('checkout.days', { days: rentalDays(from, to) })}</p>
      </header>

      <section id="co-docs-block" aria-labelledby="co-docs" className="flex scroll-mt-4 flex-col gap-3">
        <h2 id="co-docs" className="m-0 text-title-2">{t('checkout.docs.title')}</h2>
        <p className="m-0 text-body text-ink-muted">{t('checkout.docs.lead')}</p>
        <ChipGroup label={t('checkout.docs.category')}>
          {LICENSES.map((c) => (
            <Chip key={c} variant="option" selected={license === c} onClick={() => { haptic.selection(); void updateMe({ licenseCategory: c }).catch(() => undefined); }}>
              {t(`checkout.docs.license.${c}`)}
            </Chip>
          ))}
        </ChipGroup>
        {!licenseOk && <p role="alert" className="m-0 rounded-md bg-danger-soft p-3 text-body text-danger">{t('errors.LICENSE_REQUIRED')}</p>}
        <DocumentSlots />
        <p className="m-0 rounded-md bg-warning-soft p-3 text-caption text-warning">{t('checkout.docs.warning')}</p>
      </section>

      <section aria-labelledby="co-handover" className="flex flex-col gap-3">
        <h2 id="co-handover" className="m-0 text-title-2">{t('checkout.handover.title')}</h2>
        <ChipGroup label={t('checkout.handover.title')}>
          <Chip variant="option" icon={Store} selected={!delivery} onClick={() => { haptic.selection(); setDelivery(false); }}>
            {t('checkout.handover.pickup')}
          </Chip>
          {canDeliver && (
            <Chip variant="option" icon={Truck} selected={delivery} onClick={() => { haptic.selection(); setDelivery(true); }}>
              {t('checkout.handover.delivery')}
            </Chip>
          )}
        </ChipGroup>
        {!delivery ? (
          <p className="m-0 text-body text-ink-muted">{m.location.address}</p>
        ) : (
          <div className="flex flex-col gap-3">
            <Field
              label={t('checkout.handover.address')}
              placeholder={t('checkout.handover.addressPlaceholder')}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              autoComplete="street-address"
              error={attempted && !address.trim() ? t('checkout.blocked.address') : null}
              hint={t('checkout.handover.fee', { fee: formatPrice(m.deliveryFee ?? 0, lang, display) })}
            />
            <Suspense fallback={<Skeleton className="h-[224px] w-full" />}>
              <DeliveryMap center={point} pin={pin ?? point} onPick={setPin} label={t('checkout.handover.map')} />
            </Suspense>
            <p className="m-0 text-caption text-ink-muted">{t('checkout.handover.mapHint')}</p>
          </div>
        )}
      </section>

      {m.extras.length > 0 && (
        <section aria-labelledby="co-extras" className="flex flex-col gap-2">
          <h2 id="co-extras" className="m-0 text-title-2">{t('checkout.extras.title')}</h2>
          <ul className="m-0 flex list-none flex-col p-0">
            {m.extras.map((x) => {
              const qty = extras[x.id] ?? 0;
              const set = (next: number) => { haptic.selection(); setExtras((e) => ({ ...e, [x.id]: Math.min(x.maxQty, Math.max(0, next)) })); };
              return (
                <li key={x.id} className="flex items-center gap-3 border-b border-line py-3 last:border-b-0">
                  <div className="min-w-0 flex-1">
                    <p className="m-0 text-body-strong">{pickText(x.name, lang)}</p>
                    <p className="tabular m-0 text-caption text-ink-muted">
                      {formatPrice(x.price, lang, display)} · {t(x.per === 'DAY' ? 'checkout.extras.perDay' : 'checkout.extras.once')}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <IconButton icon={Minus} label={t('checkout.extras.less', { name: pickText(x.name, lang) })} onClick={() => set(qty - 1)} disabled={qty === 0} />
                    <span className="tabular w-6 text-center text-body-strong" aria-live="polite">{qty}</span>
                    <IconButton icon={Plus} label={t('checkout.extras.more', { name: pickText(x.name, lang) })} onClick={() => set(qty + 1)} disabled={qty >= x.maxQty} />
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section aria-labelledby="co-contact" className="flex flex-col gap-3">
        <h2 id="co-contact" className="m-0 text-title-2">{t('checkout.contact.title')}</h2>
        <p className="m-0 flex items-center gap-2 text-body">
          <Icon icon={UserRound} size={20} className="text-ink-muted" />
          <span className="min-w-0 break-words">
            {[user.firstName, user.lastName].filter(Boolean).join(' ') || '—'}
            {user.username && <span className="text-ink-muted"> · @{user.username}</span>}
          </span>
        </p>
        <Field
          label={t('checkout.contact.phone')}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="+84 912 345 678"
          value={phone}
          onChange={(e) => setPhoneInput(e.target.value)}
          onBlur={() => setPhoneTouched(true)}
          error={phoneError}
          hint={contactNote === 'sent' ? t('checkout.contact.sentNoPhone') : t('checkout.contact.hint')}
        />
        <Button variant="secondary" size="sm" className="self-start" onClick={() => void shareContact()}>
          {t('checkout.contact.share')}
        </Button>
      </section>

      <section aria-labelledby="co-pay" className="flex flex-col gap-3">
        <h2 id="co-pay" className="m-0 text-title-2">{t('checkout.method.title')}</h2>
        <ChipGroup label={t('checkout.method.title')}>
          <Chip variant="option" icon={Landmark} selected={method === 'VIETQR'} onClick={() => { haptic.selection(); setMethodChoice('VIETQR'); }}>
            {t('checkout.method.vietqr')}
          </Chip>
          <Chip variant="option" icon={Banknote} selected={method === 'CASH'} onClick={() => { haptic.selection(); setMethodChoice('CASH'); }}>
            {t('checkout.method.cash')}
          </Chip>
          {rubPerVnd && (
            <Chip variant="option" icon={RussianRuble} selected={method === 'RUB_TRANSFER'} onClick={() => { haptic.selection(); setMethodChoice('RUB_TRANSFER'); }}>
              {t('checkout.method.rub')}
            </Chip>
          )}
        </ChipGroup>
        <p className="m-0 text-caption text-ink-muted">{method === 'RUB_TRANSFER' ? t('checkout.method.rubNote') : method === 'VIETQR' ? t('checkout.method.vietqrNote') : prepayPercent > 0 ? t('checkout.method.cashPrepayNote', { percent: prepayPercent }) : t('checkout.method.cashNote')}</p>
      </section>

      <section aria-labelledby="co-sum" className="flex flex-col gap-3">
        <h2 id="co-sum" className="m-0 text-title-2">{t('checkout.breakdown.title')}</h2>
        <Breakdown quote={q} method={method} prepayPercent={prepayPercent} rubPerVnd={rubPerVnd} lang={lang} display={display} />
      </section>

      <label className="flex min-h-control-md cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => { haptic.selection(); setAgreed(e.target.checked); }}
          className="mt-0.5 h-6 w-6 shrink-0 accent-[var(--accent)]"
        />
        <span className="text-body">
          {t('checkout.consent.text')}{' '}
          <button type="button" onClick={(e) => { e.preventDefault(); setRulesOpen(true); }} className="text-accent-text underline underline-offset-2">
            {t('checkout.consent.rules')}
          </button>
        </span>
      </label>

      {blocked === 'documents' && !otherError ? (
        <button type="button" role="alert" onClick={() => document.getElementById('co-docs-block')?.scrollIntoView({ behavior: 'smooth' })} className="min-h-control-md rounded-md bg-accent-soft px-4 py-2 text-left text-body-strong text-accent-text">
          {reasonText}
        </button>
      ) : (reasonText || otherError) && (
        <p role="alert" aria-live="polite" className={`m-0 text-caption ${otherError ? 'text-danger' : 'text-ink-muted'}`}>
          {otherError ?? reasonText}
        </p>
      )}
      <RulesSheet open={rulesOpen} onClose={() => setRulesOpen(false)} />
      <MainAction text={ctaText} onClick={submit} disabled={!!blocked} loading={create.isPending} />
    </div>
  );
}

function CheckoutSkeleton() {
  return (
    <div aria-busy="true" className="flex flex-col gap-6 px-4 pt-2">
      <Skeleton className="h-8 w-2/3" />
      <Skeleton className="h-14 w-full" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-[128px] w-full" />
    </div>
  );
}
