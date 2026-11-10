import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Chip, ChipGroup, Sheet } from '@rental/ui';
import { formatPrice } from '@rental/i18n';
import { useDisplayCurrency } from '../profile/settings';
import { CATALOG_SORTS, CC_RANGES, MODEL_FEATURES, TRANSMISSIONS, type Lang } from '@rental/shared';
import { useHaptic } from '@/app/context';
import type { DateRange } from '../dates/range';
import { useModelCount } from './api';
import { EMPTY_FILTERS, type CatalogFilters } from './filters';

export const PRICE_STEP = 10_000;

export interface FleetBounds {
  /** Максимальная цена в день по парку, VND, округлена вверх до шага. */
  priceMax: number;
  brands: string[];
}

export interface FiltersSheetProps {
  open: boolean;
  onClose: () => void;
  filters: CatalogFilters;
  bounds: FleetBounds;
  range: DateRange | null;
  onApply: (next: CatalogFilters) => void;
}

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = window.setTimeout(() => setV(value), ms);
    return () => window.clearTimeout(id);
  }, [value, ms]);
  return v;
}

const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

/** Шторка фильтров: «Сбросить» и «Показать N байков» — N считает сервер до применения. */
export function FiltersSheet({ open, onClose, filters, bounds, range, onApply }: FiltersSheetProps) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language as Lang;
  const display = useDisplayCurrency();
  const haptic = useHaptic();
  const [draft, setDraft] = useState(filters);
  useEffect(() => {
    if (open) setDraft(filters);
  }, [open]);

  const debounced = useDebounced(draft, 250);
  const count = useModelCount(debounced, range, open);
  const settled = debounced === draft;
  const n = settled ? count.data?.count : undefined;

  const set = (patch: Partial<CatalogFilters>) => {
    haptic.selection();
    setDraft((d) => ({ ...d, ...patch }));
  };
  const toggleIn = (key: 'type' | 'cc' | 'brand' | 'options', v: string) => set({ [key]: toggle(draft[key], v) });

  const min = draft.priceMin ?? 0;
  const max = draft.priceMax ?? bounds.priceMax;
  const setMin = (v: number) => set({ ...(v <= 0 ? { priceMin: undefined } : { priceMin: Math.min(v, max) }) });
  const setMax = (v: number) => set({ ...(v >= bounds.priceMax ? { priceMax: undefined } : { priceMax: Math.max(v, min) }) });

  const reset = () => {
    haptic.selection();
    setDraft({ ...EMPTY_FILTERS, ...(filters.q ? { q: filters.q } : {}), category: filters.category });
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t('catalog.filters.title')}
      closeLabel={t('common.actions.close')}
      footer={
        <div className="flex gap-3">
          <Button variant="secondary" size="lg" onClick={reset}>
            {t('catalog.filters.reset')}
          </Button>
          <Button
            size="lg"
            block
            disabled={n === 0}
            onClick={() => {
              onApply(draft);
              onClose();
            }}
          >
            {n === undefined ? t('catalog.filters.showUnknown') : n === 0 ? t('catalog.filters.showNone') : t('catalog.filters.show', { count: n })}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-6 pb-2">
        <Group title={t('catalog.filters.type')}>
          {TRANSMISSIONS.map((v) => (
            <Chip key={v} variant="option" selected={draft.type.includes(v)} onClick={() => toggleIn('type', v)}>
              {t(`catalog.type.${v}`)}
            </Chip>
          ))}
        </Group>
        <Group title={t('catalog.filters.cc')}>
          {CC_RANGES.map((v) => (
            <Chip key={v} variant="option" selected={draft.cc.includes(v)} onClick={() => toggleIn('cc', v)}>
              {t(`catalog.cc.${v}`)}
            </Chip>
          ))}
        </Group>

        <section className="flex flex-col gap-3" aria-labelledby="price-title">
          <div className="flex items-baseline justify-between gap-3">
            <h3 id="price-title" className="m-0 text-headline">
              {t('catalog.filters.price')}
            </h3>
            <span className="tabular text-caption text-ink-muted">
              {t('catalog.filters.priceRange', { min: formatPrice(min, lang, display), max: formatPrice(max, lang, display) })}
            </span>
          </div>
          <label className="flex flex-col gap-1 text-caption text-ink-muted">
            {t('catalog.filters.priceFrom')}
            <input type="range" min={0} max={bounds.priceMax} step={PRICE_STEP} value={min} onChange={(e) => setMin(Number(e.target.value))} className="h-control-md w-full accent-accent" />
          </label>
          <label className="flex flex-col gap-1 text-caption text-ink-muted">
            {t('catalog.filters.priceTo')}
            <input type="range" min={0} max={bounds.priceMax} step={PRICE_STEP} value={max} onChange={(e) => setMax(Number(e.target.value))} className="h-control-md w-full accent-accent" />
          </label>
        </section>

        {bounds.brands.length > 0 && (
          <Group title={t('catalog.filters.brand')}>
            {bounds.brands.map((b) => (
              <Chip key={b} variant="option" selected={draft.brand.includes(b)} onClick={() => toggleIn('brand', b)}>
                {b}
              </Chip>
            ))}
          </Group>
        )}
        <Group title={t('catalog.filters.options')}>
          {MODEL_FEATURES.map((v) => (
            <Chip key={v} variant="option" selected={draft.options.includes(v)} onClick={() => toggleIn('options', v)}>
              {t(`catalog.feature.${v}`)}
            </Chip>
          ))}
        </Group>
        <Group title={t('catalog.filters.sort')}>
          {CATALOG_SORTS.map((v) => (
            <Chip key={v} variant="option" selected={draft.sort === v} onClick={() => set({ sort: draft.sort === v ? undefined : v })}>
              {t(`catalog.sort.${v}`)}
            </Chip>
          ))}
        </Group>
      </div>
    </Sheet>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="m-0 text-headline">{title}</h3>
      <ChipGroup label={title}>{children}</ChipGroup>
    </section>
  );
}
