import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Heart, PackageSearch } from 'lucide-react';
import { EmptyState, useDelayedFlag } from '@rental/ui';
import { locationHours, useFavorites, useHome } from '../catalog/api';
import { ModelCardView } from '../catalog/ModelCardView';
import { GridSkeleton } from '../catalog/Skeletons';
import { useDates } from '../dates/store';

/** Вкладка «Избранное»: сетка моделей с сердечком; пусто — подсказка и «Открыть каталог». */
export default function FavoritesScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { range, link } = useDates();
  const favorites = useFavorites(range);
  const home = useHome(range);
  const loc = locationHours(home.data?.location);
  const showSkeleton = useDelayedFlag(favorites.isLoading);
  const items = favorites.data?.items ?? [];

  return (
    <div className="flex flex-col gap-4 px-4 pt-2">
      <h1 className="m-0 text-title-1">{t('favorites.title')}</h1>
      {favorites.isError ? (
        <EmptyState
          tone="danger"
          icon={PackageSearch}
          title={t('favorites.error.title')}
          text={t('favorites.error.text')}
          action={{ label: t('common.actions.retry'), onClick: () => void favorites.refetch() }}
        />
      ) : favorites.isLoading ? (
        showSkeleton ? <GridSkeleton /> : null
      ) : items.length === 0 ? (
        <EmptyState
          icon={Heart}
          title={t('favorites.empty.title')}
          text={t('favorites.empty.text')}
          action={{ label: t('favorites.empty.action'), onClick: () => navigate(link('/catalog')) }}
        />
      ) : (
        <div className="grid grid-cols-2 gap-x-3 gap-y-6">
          {items.map((m, i) => (
            <ModelCardView key={m.id} model={m} range={range} link={link} timezone={loc.timezone} eager={i < 2} />
          ))}
        </div>
      )}
    </div>
  );
}
