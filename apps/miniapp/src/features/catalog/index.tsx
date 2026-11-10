import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CalendarDays, ChevronRight, PackageSearch, Search, SlidersHorizontal, CalendarClock } from 'lucide-react';
import { pickText } from '@rental/i18n';
import { Chip, ChipGroup, EmptyState, Icon, IconButton, useDelayedFlag } from '@rental/ui';
import { MODEL_CATEGORIES, type Lang, type ModelCard } from '@rental/shared';
import { useQuery } from '@tanstack/react-query';
import { missingDocuments } from '@rental/shared';
import type { DocumentListResponse } from '@rental/shared';
import { useApp, useHaptic } from '@/app/context';
import { NowQuickSheet } from '../home/NowQuickSheet';
import { quickPayEligible } from '../home/quick';
import { formatRangeShort } from '../dates/format';
import { useDates } from '../dates/store';
import { locationHours, useHome, useModels, useTrack } from './api';
import { FiltersSheet, PRICE_STEP, type FleetBounds } from './FiltersSheet';
import { activeCount, EMPTY_FILTERS, parseFilters, toParams, type CatalogFilters } from './filters';
import { checkoutPath, ModelCardView, needsLicense } from './ModelCardView';
import { GridSkeleton } from './Skeletons';

/** Каталог: поиск, категории, фильтры в шторке, сетка карточек; пустые состояния с действием. */
export default function CatalogScreen() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language as Lang;
  const navigate = useNavigate();
  const haptic = useHaptic();
  const track = useTrack();
  const [params, setParams] = useSearchParams();
  const { api, user } = useApp();
  const { range, link } = useDates();
  // «Нужен байк сейчас» (?now=1): только свободные байки, выбор ведёт в оформление, а повторному клиенту — к оплате.
  const nowMode = params.get('now') === '1';
  const [quickModel, setQuickModel] = useState<ModelCard | null>(null);
  const documents = useQuery({ queryKey: ['documents'], queryFn: () => api.request<DocumentListResponse>('/documents'), enabled: nowMode });
  const filters = useMemo(() => parseFilters(params), [params]);
  const [sheet, setSheet] = useState(params.get('sheet') === 'filters');

  const models = useModels(filters, range);
  const fleet = useModels(EMPTY_FILTERS, range);
  const home = useHome(range);
  const points = home.data?.points ?? [];
  const loc = locationHours(points.find((p) => p.id === filters.locationId) ?? home.data?.location);
  const showSkeleton = useDelayedFlag(models.isLoading);

  const bounds: FleetBounds = useMemo(() => {
    const items = fleet.data?.items ?? [];
    const max = Math.max(PRICE_STEP, ...items.map((m) => m.pricePerDay));
    return {
      priceMax: Math.ceil(max / PRICE_STEP) * PRICE_STEP,
      brands: [...new Set(items.map((m) => m.brand.name))].sort(),
    };
  }, [fleet.data]);

  const update = (next: CatalogFilters) => setParams(toParams(next, params), { replace: true });

  // Поиск: текст в поле сразу, в URL и запрос — после паузы.
  const [text, setText] = useState(filters.q ?? '');
  useEffect(() => {
    const id = window.setTimeout(() => {
      const q = text.trim();
      if (q !== (filters.q ?? '')) update({ ...filters, ...(q ? { q } : { q: undefined }) });
    }, 300);
    return () => window.clearTimeout(id);
  }, [text]);

  const items = (models.data?.items ?? []).filter((m) => !nowMode || m.available);
  const nothingFree = !!range && items.length > 0 && items.every((m) => !m.available);
  const hasFilters = activeCount(filters) > 0 || !!filters.q || filters.category.length > 0 || !!filters.locationId;
  const period = range ? formatRangeShort(new Date(range.from), new Date(range.to), lang, loc.timezone) : null;
  const filtersCount = activeCount(filters);

  const bookNow = (m: ModelCard) => {
    const eligible = quickPayEligible({ phone: user.phone, documentsReady: !!documents.data && missingDocuments(documents.data.items, user.licenseCategory).length === 0, needsLicense: needsLicense(m, user.licenseCategory), delivery: false });
    if (eligible) setQuickModel(m);
    else navigate(link(checkoutPath(m.id)));
  };

  const clearAll = () => {
    setText('');
    setParams(toParams(EMPTY_FILTERS, params), { replace: true });
  };

  return (
    <div className="flex flex-col gap-4 px-4 pt-2">
      <h1 className="m-0 text-title-1">{nowMode ? t('home.now.listTitle') : t('catalog.title')}</h1>
      {nowMode && <p className="m-0 text-body text-ink-muted">{t('home.now.listText')}</p>}

      <div className="flex items-center gap-2">
        <label className="relative flex-1">
          <span className="sr-only">{t('catalog.search.label')}</span>
          <Icon icon={Search} size={20} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-muted" />
          <input
            type="search"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t('catalog.search.placeholder')}
            enterKeyHint="search"
            className="h-control-md w-full rounded-pill border border-line-strong bg-bg pl-11 pr-4 text-body text-ink placeholder:text-ink-muted"
          />
        </label>
        <div className="relative">
          <IconButton
            icon={SlidersHorizontal}
            variant="inverse"
            label={filtersCount ? t('catalog.filters.openCount', { count: filtersCount }) : t('catalog.filters.open')}
            onClick={() => {
              haptic.selection();
              setSheet(true);
            }}
          />
          {filtersCount > 0 && (
            <span aria-hidden className="tabular absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-pill border border-line-strong bg-bg px-1 text-label text-ink">
              {filtersCount}
            </span>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={() => navigate(link('/dates'))}
        className="flex min-h-control-md items-center gap-3 rounded-md bg-surface px-4 py-2 text-left"
      >
        <Icon icon={CalendarDays} size={20} className="text-ink-muted" />
        <span className="flex-1 text-body-strong">{period ?? t('catalog.dates.pick')}</span>
        <Icon icon={ChevronRight} size={20} className="text-ink-muted" />
      </button>

      {points.length > 1 && (
        <ChipGroup label={t('catalog.filters.point')} scroll>
          <Chip selected={!filters.locationId} onClick={() => update({ ...filters, locationId: undefined })}>
            {t('catalog.filters.allPoints')}
          </Chip>
          {points.map((p) => (
            <Chip key={p.id} selected={filters.locationId === p.id} onClick={() => update({ ...filters, locationId: p.id })}>
              {pickText(p.name, lang)}
            </Chip>
          ))}
        </ChipGroup>
      )}

      <ChipGroup label={t('catalog.filters.category')} scroll>
        <Chip
          selected={filters.category.length === 0}
          onClick={() => {
            haptic.selection();
            update({ ...filters, category: [] });
          }}
        >
          {t('catalog.category.ALL')}
        </Chip>
        {MODEL_CATEGORIES.map((c) => (
          <Chip
            key={c}
            selected={filters.category.includes(c)}
            onClick={() => {
              haptic.selection();
              update({ ...filters, category: filters.category.includes(c) ? [] : [c] });
            }}
          >
            {t(`catalog.category.${c}`)}
          </Chip>
        ))}
      </ChipGroup>

      {models.isError ? (
        <EmptyState
          tone="danger"
          icon={PackageSearch}
          title={t('catalog.error.title')}
          text={t('catalog.error.text')}
          action={{ label: t('common.actions.retry'), onClick: () => void models.refetch() }}
        />
      ) : models.isLoading ? (
        showSkeleton ? <GridSkeleton /> : null
      ) : items.length === 0 ? (
        <EmptyState
          icon={PackageSearch}
          title={t('catalog.empty.none.title')}
          text={t('catalog.empty.none.text')}
          action={hasFilters ? { label: t('catalog.empty.none.action'), onClick: clearAll } : { label: t('catalog.empty.none.pickDates'), onClick: () => navigate(link('/dates')) }}
        />
      ) : (
        <>
          {nothingFree && (
            <EmptyState
              icon={CalendarClock}
              title={t('catalog.empty.busy.title', { period })}
              text={t('catalog.empty.busy.text')}
              action={{ label: t('catalog.empty.busy.action'), onClick: () => navigate(link('/dates')) }}
              className="rounded-lg bg-surface"
            />
          )}
          <p className="m-0 text-caption text-ink-muted" aria-live="polite">
            {t('catalog.count', { count: nowMode ? items.length : (models.data?.count ?? items.length) })}
          </p>
          <div className="grid grid-cols-2 gap-x-3 gap-y-6">
            {items.map((m, i) => (
              <ModelCardView key={m.id} model={m} range={range} link={link} timezone={loc.timezone} eager={i < 2} onBook={nowMode ? bookNow : undefined} />
            ))}
          </div>
        </>
      )}

      {range && <NowQuickSheet model={quickModel} range={range} timezone={loc.timezone} onClose={() => setQuickModel(null)} />}

      <FiltersSheet
        open={sheet}
        onClose={() => setSheet(false)}
        filters={filters}
        bounds={bounds}
        range={range}
        onApply={(next) => {
          update(next);
          track('filters_applied', { count: activeCount(next) });
        }}
      />
    </div>
  );
}
