import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useSyncExternalStore } from 'react';
import type {
  AnalyticsEventName,
  FavoritesResponse,
  HomeResponse,
  ModelCountResponse,
  ModelDetail,
  ModelListResponse,
  NowResponse,
  LocationInfo,
} from '@rental/shared';
import { useApp } from '@/app/context';
import { rangeToParams, type DateRange } from '../dates/range';
import { toParams, type CatalogFilters, EMPTY_FILTERS } from './filters';

// Запросы Mini App к каталогу, главной, избранному. Ответы — типы из @rental/shared.

export const DEFAULT_TIMEZONE = 'Asia/Ho_Chi_Minh';

const rangeKey = (r: DateRange | null) => (r ? `${r.from}|${r.to}` : 'none');

/** Параметры GET /models и /models/count: фильтры + даты. */
export function modelsParams(filters: CatalogFilters, range: DateRange | null): URLSearchParams {
  return rangeToParams(range, toParams(filters));
}

export function useModels(filters: CatalogFilters, range: DateRange | null, enabled = true) {
  const { api } = useApp();
  const qs = modelsParams(filters, range).toString();
  return useQuery({
    queryKey: ['models', qs],
    queryFn: () => api.request<ModelListResponse>(`/models${qs ? `?${qs}` : ''}`),
    enabled,
  });
}

/** «Показать N байков» до применения: число считает сервер. */
export function useModelCount(filters: CatalogFilters, range: DateRange | null, enabled: boolean) {
  const { api } = useApp();
  const qs = modelsParams(filters, range).toString();
  return useQuery({
    queryKey: ['models-count', qs],
    queryFn: () => api.request<ModelCountResponse>(`/models/count${qs ? `?${qs}` : ''}`),
    enabled,
    placeholderData: (prev) => prev,
  });
}

export function useHome(range: DateRange | null) {
  const { api } = useApp();
  return useQuery({
    queryKey: ['home', rangeKey(range)],
    queryFn: () => api.request<HomeResponse>(`/home${range ? `?${rangeToParams(range)}` : ''}`),
  });
}

export function useNow() {
  const { api } = useApp();
  return { fetchNow: () => api.request<NowResponse>('/now') };
}

export function useModel(id: string, range: DateRange | null) {
  const { api } = useApp();
  return useQuery({
    queryKey: ['model', id, rangeKey(range)],
    queryFn: () => api.request<ModelDetail>(`/models/${encodeURIComponent(id)}${range ? `?${rangeToParams(range)}` : ''}`),
  });
}

export function useFavorites(range: DateRange | null) {
  const { api } = useApp();
  return useQuery({
    queryKey: ['favorites', rangeKey(range)],
    queryFn: () => api.request<FavoritesResponse>(`/favorites${range ? `?${rangeToParams(range)}` : ''}`),
  });
}

/** Часы и пояс точки: из ответа /home; пока не загрузился — безопасные значения по умолчанию. */
export function locationHours(location: LocationInfo | null | undefined) {
  return {
    openTime: location?.openTime ?? '08:00',
    closeTime: location?.closeTime ?? '20:00',
    timezone: location?.timezone ?? DEFAULT_TIMEZONE,
  };
}

/** Воронка: fire-and-forget, ошибки аналитики пользователю не показываются. */
export function useTrack() {
  const { api } = useApp();
  return useCallback(
    (name: AnalyticsEventName, props?: Record<string, string | number | boolean | null>) => {
      void api.request('/events', { method: 'POST', json: { name, props } }).catch(() => undefined);
    },
    [api],
  );
}

// Избранное: мгновенный отклик сердечка до ответа сервера.
const overrides = new Map<string, boolean>();
const listeners = new Set<() => void>();
let version = 0;
const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => void listeners.delete(fn);
};
function setOverride(id: string, value: boolean | null) {
  if (value === null) overrides.delete(id);
  else overrides.set(id, value);
  version++;
  listeners.forEach((fn) => fn());
}

export function useFavorite(modelId: string, serverValue: boolean): { favorite: boolean; toggle(): void } {
  const { api, platform } = useApp();
  const qc = useQueryClient();
  const track = useTrack();
  useSyncExternalStore(subscribe, () => version);
  const favorite = overrides.get(modelId) ?? serverValue;
  const mutation = useMutation({
    mutationFn: (next: boolean) =>
      api.request<unknown>(`/favorites/${encodeURIComponent(modelId)}`, { method: next ? 'POST' : 'DELETE' }),
    onSuccess: async () => {
      await Promise.all([qc.invalidateQueries({ queryKey: ['favorites'] }), qc.invalidateQueries({ queryKey: ['models'] }), qc.invalidateQueries({ queryKey: ['home'] }), qc.invalidateQueries({ queryKey: ['model', modelId] })]);
      setOverride(modelId, null);
    },
    onError: () => setOverride(modelId, null),
  });
  const toggle = () => {
    const next = !favorite;
    platform.haptic.impact('light');
    setOverride(modelId, next);
    if (next) track('favorite_added', { modelId });
    mutation.mutate(next);
  };
  return { favorite, toggle };
}

export { EMPTY_FILTERS };
