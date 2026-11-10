import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, CalendarDays, Check, ChevronRight, Heart, MapPin, PackageSearch, Star } from 'lucide-react';
import { Badge, Button, EmptyState, Icon, IconButton, Skeleton, type DisplayCurrency } from '@rental/ui';
import { formatPrice, pickText } from '@rental/i18n';
import type { Lang, ModelDetail, TariffBracket } from '@rental/shared';
import { useApp } from '@/app/context';
import { MainAction } from '@/app/shell/MainAction';
import { useDisplayCurrency } from '../profile/settings';
import { useFavorite, useModel, useTrack } from '../catalog/api';
import { checkoutPath, needsLicense } from '../catalog/ModelCardView';
import { formatRangeShort, formatShortDate } from '../dates/format';
import { useDates } from '../dates/store';
import { ratingView } from '../catalog/rating';
import { conditionsView, REQUIRED_DOCUMENTS } from './conditions';
import { Gallery } from './Gallery';

/** Карточка модели: галерея, плитки характеристик, тарифная сетка, условия, MainButton «Забронировать · сумма». */
export default function BikeScreen() {
  const { modelId = '' } = useParams();
  const { t, i18n } = useTranslation();
  const lang = i18n.language as Lang;
  const navigate = useNavigate();
  const { user } = useApp();
  const display = useDisplayCurrency();
  const { range, link } = useDates();
  const track = useTrack();
  const model = useModel(modelId, range);

  useEffect(() => {
    track('model_viewed', { modelId });
  }, [modelId, track]);

  if (model.isLoading) return <BikeSkeleton />;
  if (model.isError || !model.data) {
    return (
      <EmptyState
        tone="danger"
        icon={PackageSearch}
        title={t('bike.error.title')}
        text={t('bike.error.text')}
        action={{ label: t('common.actions.retry'), onClick: () => void model.refetch() }}
        className="mt-8"
      />
    );
  }
  const m = model.data;
  const rating = ratingView(m);
  const restrictions = conditionsView(m.conditions, lang);
  const tz = m.location.timezone;
  const busy = !!range && !m.available;
  const datesPath = link('/dates', new URLSearchParams({ model: m.id }));

  const action = !range
    ? { text: t('bike.action.pickDates'), run: () => navigate(datesPath), disabled: false }
    : busy
      ? { text: t('bike.action.busy'), run: () => undefined, disabled: true }
      : { text: t('bike.action.book', { price: formatPrice(m.total ?? m.pricePerDay, lang, display) }), run: () => navigate(link(checkoutPath(m.id))), disabled: m.total === null };

  return (
    <div className="flex flex-col gap-6 px-4 pt-2">
      <div className="relative">
        <Gallery photos={m.photos} name={m.name} />
        <FavoriteButton model={m} />
      </div>

      <header className="flex flex-col gap-2">
        <h1 className="m-0 text-title-1 text-balance">{m.name}</h1>
        <p className="m-0 flex flex-wrap items-center gap-x-3 gap-y-1 text-body text-ink-muted">
          <span>{m.brand.name}</span>
          {m.year && <span className="tabular">{m.year}</span>}
          {rating.show && m.rating !== null && (
            <span className="inline-flex items-center gap-1 text-ink">
              <Icon icon={Star} size={16} filled className="text-rating" />
              <span className="tabular text-body-strong">{m.rating.toFixed(1)}</span>
              {rating.showCount && <span className="text-ink-muted">{t('bike.reviews', { count: m.reviewsCount })}</span>}
              {rating.demo && <Badge plain>{t('bike.ratingDemo')}</Badge>}
            </span>
          )}
          {m.isDemo && <Badge plain>{t('bike.demo')}</Badge>}
        </p>
        {needsLicense(m, user.licenseCategory) && (
          <div>
            <Badge tone="warning" plain>
              {t('bike.license.badge')}
            </Badge>
          </div>
        )}
      </header>

      {needsLicense(m, user.licenseCategory) && (
        <div role="note" className="flex gap-3 rounded-md bg-warning-soft p-4 text-warning">
          <Icon icon={AlertTriangle} size={20} className="mt-0.5" />
          <p className="m-0 text-body">
            {t('bike.license.warning')}
          </p>
        </div>
      )}

      <button
        type="button"
        onClick={() => navigate(datesPath)}
        className="flex min-h-control-md items-center gap-3 rounded-md bg-surface px-4 py-2 text-left"
      >
        <Icon icon={CalendarDays} size={20} className="text-ink-muted" />
        <span className="flex-1">
          <span className="tabular block text-body-strong">
            {range ? formatRangeShort(new Date(range.from), new Date(range.to), lang, tz) : t('bike.dates.none')}
          </span>
          {busy && (
            <span className="block text-caption text-ink-muted">
              {m.busyUntil ? t('bike.dates.busyUntil', { date: formatShortDate(new Date(m.busyUntil), lang, tz) }) : t('bike.dates.busy')}
            </span>
          )}
        </span>
        <Icon icon={ChevronRight} size={20} className="text-ink-muted" />
      </button>

      <Specs model={m} />

      <section className="flex flex-col gap-2" aria-labelledby="about-title">
        <h2 id="about-title" className="m-0 text-title-2">
          {t('bike.about')}
        </h2>
        <p className="m-0 text-body">{pickText(m.description, lang)}</p>
      </section>

      <Tariffs tariffs={m.tariffs} days={m.days} lang={lang} display={display} />

      {m.included.length > 0 && (
        <section className="flex flex-col gap-3" aria-labelledby="included-title">
          <h2 id="included-title" className="m-0 text-title-2">
            {t('bike.included')}
          </h2>
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {m.included.map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-body">
                <Icon icon={Check} size={20} className="mt-0.5 text-success" />
                {pickText(item, lang)}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="flex flex-col gap-3" aria-labelledby="conditions-title">
        <h2 id="conditions-title" className="m-0 text-title-2">
          {t('bike.conditions')}
        </h2>
        <dl className="m-0 flex flex-col gap-2 text-body">
          <div className="flex flex-wrap justify-between gap-x-4">
            <dt className="text-ink-muted">{t('bike.deposit')}</dt>
            <dd className="tabular m-0 text-body-strong">
              {m.depositMode === 'MONEY' ? formatPrice(m.deposit, lang, display) : t('bike.depositDocument')}
            </dd>
          </div>
          <div className="flex flex-wrap justify-between gap-x-4">
            <dt className="text-ink-muted">{t('bike.pickup')}</dt>
            <dd className="m-0 flex items-start gap-1.5 text-body-strong">
              <Icon icon={MapPin} size={16} className="mt-[3px]" />
              <span>{m.location.address}</span>
            </dd>
          </div>
        </dl>
      </section>

      <section className="flex flex-col gap-2" aria-labelledby="docs-title">
        <h3 id="docs-title" className="m-0 text-headline">
          {t('bike.docs.title')}
        </h3>
        <ul className="m-0 flex list-none flex-col gap-1.5 p-0 text-body">
          {REQUIRED_DOCUMENTS.map((d) => (
            <li key={d} className="flex items-start gap-2">
              <Icon icon={Check} size={16} className="mt-[3px] flex-none text-success" />
              <span>{t(`bike.docs.${d}`)}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-2" aria-labelledby="restrictions-title">
        <h3 id="restrictions-title" className="m-0 text-headline">
          {t('bike.restrictions.title')}
        </h3>
        {restrictions.kind === 'text' ? (
          <p className="m-0 whitespace-pre-line text-body text-ink-muted">{restrictions.text}</p>
        ) : (
          <p className="m-0 rounded-md bg-warning-soft p-3 text-body text-warning">{t('bike.restrictions.placeholder')}</p>
        )}
      </section>

      {busy && (
        <Button variant="secondary" block onClick={() => navigate(datesPath)}>
          {t('bike.action.changeDates')}
        </Button>
      )}

      <MainAction text={action.text} onClick={action.run} disabled={action.disabled} />
    </div>
  );
}

function FavoriteButton({ model }: { model: ModelDetail }) {
  const { t } = useTranslation();
  const { favorite, toggle } = useFavorite(model.id, model.isFavorite);
  return (
    <span className="absolute right-3 top-3">
    <IconButton
      icon={Heart}
      variant="float"
      pressed={favorite}
      label={favorite ? t('catalog.card.favoriteRemove', { name: model.name }) : t('catalog.card.favoriteAdd', { name: model.name })}
      onClick={toggle}
    />
    </span>
  );
}

/** Шесть плиток: объём, КПП, расход, бак, макс. скорость, вместимость. */
function Specs({ model }: { model: ModelDetail }) {
  const { t } = useTranslation();
  const s = model.specs;
  const dash = '—';
  const tiles: Array<[string, string]> = [
    [t('bike.spec.cc'), s.engineCc ? t('bike.spec.ccValue', { cc: s.engineCc }) : t('bike.spec.electric')],
    [t('bike.spec.transmission'), t(`catalog.type.${s.transmission}`)],
    [t('bike.spec.fuel'), s.fuelConsumption !== null ? t('bike.spec.fuelValue', { value: s.fuelConsumption }) : dash],
    [t('bike.spec.tank'), s.tankLiters !== null ? t('bike.spec.tankValue', { value: s.tankLiters }) : dash],
    [t('bike.spec.speed'), s.maxSpeedKmh !== null ? t('bike.spec.speedValue', { value: s.maxSpeedKmh }) : dash],
    [t('bike.spec.seats'), t('bike.spec.seatsValue', { count: s.seats })],
  ];
  return (
    <section aria-label={t('bike.spec.title')}>
      <dl className="m-0 grid grid-cols-3 gap-2">
        {tiles.map(([label, value]) => (
          <div key={label} className="flex min-w-0 flex-col gap-1 rounded-md bg-surface p-3">
            <dt className="text-caption text-ink-muted [overflow-wrap:anywhere]">{label}</dt>
            <dd className="tabular m-0 text-body-strong [overflow-wrap:anywhere]">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function Tariffs({ tariffs, days, lang, display }: { tariffs: TariffBracket[]; days: number | null; lang: Lang; display?: DisplayCurrency }) {
  const { t } = useTranslation();
  if (tariffs.length === 0) return null;
  const sorted = [...tariffs].sort((a, b) => a.minDays - b.minDays);
  const label = (b: TariffBracket) =>
    b.minDays <= 1 ? t('bike.tariff.day') : b.minDays >= 30 ? t('bike.tariff.month') : t('bike.tariff.from', { days: b.minDays });
  const mine = days === null ? null : sorted.find((b) => days >= b.minDays && (b.maxDays === null || days <= b.maxDays));
  return (
    <section className="flex flex-col gap-3" aria-labelledby="tariff-title">
      <h2 id="tariff-title" className="m-0 text-title-2">
        {t('bike.tariff.title')}
      </h2>
      <ul className="m-0 flex list-none flex-col gap-1 p-0">
        {sorted.map((b) => (
          <li
            key={b.minDays}
            aria-current={b === mine ? 'true' : undefined}
            className={`flex items-center justify-between gap-3 rounded-md px-4 py-3 ${b === mine ? 'bg-inverse text-on-inverse' : 'bg-surface'}`}
          >
            <span className="text-body">{label(b)}</span>
            <span className="tabular text-body-strong">
              {formatPrice(b.pricePerDay, lang, display)} <span className="text-caption font-medium opacity-70">{t('catalog.card.perDay')}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function BikeSkeleton() {
  return (
    <div aria-busy="true" className="flex flex-col gap-4 px-4 pt-2">
      <Skeleton className="aspect-[16/10] w-full !rounded-lg" />
      <Skeleton shape="text" className="h-7 w-2/3" />
      <Skeleton shape="text" className="w-1/2" />
      <div className="grid grid-cols-3 gap-2">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-16" />
        ))}
      </div>
      <Skeleton className="h-40 w-full" />
    </div>
  );
}
