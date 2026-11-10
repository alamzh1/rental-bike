import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Clock, MapPin, Search, SlidersHorizontal, Zap } from 'lucide-react';
import { Button, Chip, ChipGroup, EmptyState, Icon, IconButton, Skeleton, useDelayedFlag } from '@rental/ui';
import { formatDate, formatTime, pickText } from '@rental/i18n';
import { MODEL_CATEGORIES, type BannerInfo, type Lang } from '@rental/shared';
import { useApp, useHaptic } from '@/app/context';
import { EMPTY_FILTERS, locationHours, useHome, useModels, useNow, useTrack } from '../catalog/api';
import { ModelCardView } from '../catalog/ModelCardView';
import { GridSkeleton, CardSkeleton } from '../catalog/Skeletons';
import { rangeToParams } from '../dates/range';
import { useDates } from '../dates/store';
import { useBookings, useNow as useTick } from '../bookings/api';
import { rentalEnding } from '../bookings/status';
import { paths } from '@/app/router';
import { DatesBlock } from './DatesBlock';

const TICK_MS = 60_000;

/** Плашка на главной: аренда заканчивается в ближайшие сутки или срок уже прошёл. */
function RentalEndingBanner() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language as Lang;
  const now = useTick(TICK_MS);
  const { data } = useBookings();
  const b = data?.items.find((x) => rentalEnding(x, now));
  if (!b) return null;
  const overdue = rentalEnding(b, now) === 'overdue';
  const end = new Date(b.endAt);
  const date = `${formatDate(end, lang, b.location.timezone)} ${formatTime(end, lang, b.location.timezone)}`;
  return (
    <Link to={paths.booking(b.id)} className={`flex items-start gap-3 rounded-lg p-4 ${overdue ? 'bg-danger-soft text-danger' : 'bg-warning-soft text-warning'}`}>
      <Icon icon={overdue ? AlertTriangle : Clock} size={20} className="mt-0.5 flex-none" />
      <span className="flex min-w-0 flex-col">
        <span className="text-body-strong">{t(overdue ? 'bookings.ending.overdueTitle' : 'bookings.ending.soonTitle')}</span>
        <span className="text-body">{t('bookings.ending.banner', { model: b.modelName, date })}</span>
      </span>
    </Link>
  );
}

/** Главная: приветствие, точка выдачи, баннер, даты, «Нужен байк сейчас», бренды, категории, популярные, все байки. */
export default function HomeScreen() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language as Lang;
  const navigate = useNavigate();
  const { user } = useApp();
  const haptic = useHaptic();
  const { range, link } = useDates();
  const home = useHome(range);
  const [category, setCategory] = useState<string | null>(null);
  const grid = useModels({ ...EMPTY_FILTERS, category: category ? [category] : [] }, range);
  const showSkeleton = useDelayedFlag(home.isLoading);
  const loc = locationHours(home.data?.location);
  const [query, setQuery] = useState('');

  const data = home.data;
  const gridItems = (grid.data?.items ?? []).slice(0, 6);

  return (
    <div className="flex flex-col gap-6 px-4 pt-2">
      <RentalEndingBanner />
      <header className="flex flex-col gap-1">
        <h1 className="m-0 text-title-1 text-balance">
          {user.firstName ? t('home.greeting', { name: user.firstName }) : t('home.greetingAnon')}
        </h1>
        {data?.location ? (
          <p className="m-0 flex items-start gap-1.5 text-body text-ink-muted">
            <Icon icon={MapPin} size={16} className="mt-[3px]" />
            <span>
              {t('home.pickup', { name: pickText(data.location.name, lang), address: data.location.address })}
            </span>
          </p>
        ) : (
          showSkeleton && <Skeleton shape="text" className="w-2/3" />
        )}
      </header>

      <form
        role="search"
        className="flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const q = query.trim();
          navigate(link('/catalog', new URLSearchParams(q ? { q } : {})));
        }}
      >
        <label className="relative flex-1">
          <span className="sr-only">{t('home.search.label')}</span>
          <Icon icon={Search} size={20} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-muted" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('home.search.placeholder')}
            enterKeyHint="search"
            className="h-control-md w-full rounded-pill border border-line-strong bg-bg pl-11 pr-4 text-body text-ink placeholder:text-ink-muted"
          />
        </label>
        <IconButton
          icon={SlidersHorizontal}
          variant="inverse"
          label={t('home.filters')}
          onClick={() => {
            haptic.selection();
            navigate(link('/catalog', new URLSearchParams({ sheet: 'filters' })));
          }}
        />
      </form>

      {data?.banner && <Banner banner={data.banner} />}

      <DatesBlock />
      <NowCard />

      {home.isError && (
        <EmptyState
          tone="danger"
          icon={Zap}
          title={t('home.error.title')}
          text={t('home.error.text')}
          action={{ label: t('common.actions.retry'), onClick: () => void home.refetch() }}
        />
      )}

      {home.isLoading && showSkeleton && (
        <div aria-busy="true" className="flex flex-col gap-3">
          <Skeleton className="h-control-lg w-full" />
          <div className="flex gap-3">
            <CardSkeletonRail />
          </div>
        </div>
      )}

      {data && data.brands.length > 0 && (
        <section className="flex flex-col gap-3" aria-labelledby="brands-title">
          <h2 id="brands-title" className="m-0 text-title-2">
            {t('home.brands')}
          </h2>
          <ul className="no-scrollbar -mx-4 m-0 flex list-none gap-2 overflow-x-auto px-4 py-0 pb-1">
            {data.brands.map((b) => (
              <li key={b.id} className="flex-none">
                <Link
                  to={link('/catalog', new URLSearchParams({ brand: b.name }))}
                  className="flex h-14 min-w-[72px] items-center justify-center rounded-lg bg-surface px-4 text-caption font-bold text-ink"
                >
                  {b.logoUrl ? <img src={b.logoUrl} alt={b.name} className="h-8 w-auto max-w-[80px] object-contain" loading="lazy" /> : b.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {data && (
        <ChipGroup label={t('catalog.filters.category')} scroll>
          <Chip
            selected={category === null}
            onClick={() => {
              haptic.selection();
              setCategory(null);
            }}
          >
            {t('catalog.category.ALL')}
          </Chip>
          {MODEL_CATEGORIES.filter((c) => data.categories.some((x) => x.category === c)).map((c) => (
            <Chip
              key={c}
              selected={category === c}
              onClick={() => {
                haptic.selection();
                setCategory(category === c ? null : c);
              }}
            >
              {t(`catalog.category.${c}`)}
            </Chip>
          ))}
        </ChipGroup>
      )}

      {data && data.popular.length > 0 && (
        <section className="flex flex-col gap-3" aria-labelledby="popular-title">
          <h2 id="popular-title" className="m-0 text-title-2">
            {t('home.popular')}
          </h2>
          <div className="no-scrollbar -mx-4 flex snap-x scroll-px-4 gap-3 overflow-x-auto px-4 pb-1">
            {data.popular.map((m, i) => (
              <ModelCardView key={m.id} model={m} range={range} link={link} timezone={loc.timezone} variant="rail" eager={i < 2} />
            ))}
          </div>
        </section>
      )}

      <section className="flex flex-col gap-3" aria-labelledby="all-title">
        <h2 id="all-title" className="m-0 text-title-2">
          {t('home.all')}
        </h2>
        {grid.isLoading ? (
          <GridSkeleton count={4} />
        ) : grid.isError ? null : gridItems.length === 0 ? (
          <EmptyState icon={Search} title={t('home.empty.title')} text={t('home.empty.text')} action={{ label: t('home.empty.action'), onClick: () => navigate(link('/catalog')) }} />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-x-3 gap-y-6">
              {gridItems.map((m) => (
                <ModelCardView key={m.id} model={m} range={range} link={link} timezone={loc.timezone} />
              ))}
            </div>
            <Button variant="secondary" block onClick={() => navigate(link('/catalog', category ? new URLSearchParams({ category }) : undefined))}>
              {t('home.more', { count: grid.data?.count ?? gridItems.length })}
            </Button>
          </>
        )}
      </section>
    </div>
  );
}

function CardSkeletonRail() {
  return (
    <>
      <div className="w-40">
        <CardSkeleton />
      </div>
      <div className="w-40">
        <CardSkeleton />
      </div>
    </>
  );
}

/** «Нужен байк сейчас»: свободные с ближайшего слота на сутки. Выбранные даты заменяются периодом из /now. */
function NowCard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const haptic = useHaptic();
  const track = useTrack();
  const { fetchNow } = useNow();
  const { setRange } = useDates();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const go = async () => {
    haptic.selection();
    setBusy(true);
    setFailed(false);
    track('now_clicked');
    try {
      const now = await fetchNow();
      const next = { from: now.from, to: now.to };
      setRange(next);
      navigate(`/catalog?${rangeToParams(next, new URLSearchParams({ now: '1' }))}`);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="flex flex-col gap-3 rounded-lg bg-inverse p-4 text-on-inverse" aria-labelledby="now-title">
      <div className="flex items-start gap-3">
        <Icon icon={Zap} size={24} className="mt-0.5" />
        <div className="flex flex-col gap-1">
          <h2 id="now-title" className="m-0 text-title-2 text-balance">
            {t('home.now.title')}
          </h2>
          <p className="m-0 text-body opacity-80">{t('home.now.text')}</p>
        </div>
      </div>
      <Button variant="secondary" block loading={busy} onClick={() => void go()}>
        {t('home.now.action')}
      </Button>
      {failed && <p role="alert" className="m-0 text-caption">{t('home.now.error')}</p>}
    </section>
  );
}

function Banner({ banner }: { banner: BannerInfo }) {
  const { i18n } = useTranslation();
  const lang = i18n.language as Lang;
  const navigate = useNavigate();
  const { platform } = useApp();
  const title = pickText(banner.title, lang);
  const text = banner.text ? pickText(banner.text, lang) : null;
  const body = (
    <>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <h2 className="m-0 text-title-2 text-balance">{title}</h2>
        {text && <p className="m-0 text-body">{text}</p>}
      </div>
      {banner.imageUrl && <img src={banner.imageUrl} alt="" className="h-20 w-20 flex-none rounded-md object-cover" loading="lazy" decoding="async" />}
    </>
  );
  const cls = 'flex items-center gap-3 rounded-lg bg-promo p-4 text-left text-on-promo';
  if (!banner.link) return <section className={cls}>{body}</section>;
  const link = banner.link;
  return (
    <button
      type="button"
      className={cls}
      onClick={() => {
        if (link.startsWith('/')) navigate(link);
        else if (/^https:\/\/t\.me\//.test(link)) platform.openTelegramLink(link);
        else platform.openLink(link);
      }}
    >
      {body}
    </button>
  );
}
