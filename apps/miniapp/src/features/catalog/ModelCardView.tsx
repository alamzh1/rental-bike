import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Heart, Star } from 'lucide-react';
import { Badge, Button, IconButton, PriceText, cn, Icon } from '@rental/ui';
import { formatPrice, pickText } from '@rental/i18n';
import type { Lang, ModelCard } from '@rental/shared';
import { licenseAllows, type LicenseCategory } from '@rental/shared';
import { useApp } from '@/app/context';
import { useDisplayCurrency } from '../profile/settings';
import { formatShortDate } from '../dates/format';
import type { DateRange } from '../dates/range';
import { useFavorite, DEFAULT_TIMEZONE } from './api';
import { ModelImage } from './ModelImage';
import { ratingView } from './rating';

export const bikePath = (id: string) => `/bikes/${encodeURIComponent(id)}`;
export const checkoutPath = (id: string) => `/checkout/${encodeURIComponent(id)}`;

export interface ModelCardViewProps {
  model: ModelCard;
  /** Выбранные даты: есть — показываем итог и ведём сразу в оформление. */
  range: DateRange | null;
  /** Ссылка на путь с датами в query. */
  link: (path: string) => string;
  timezone?: string;
  /** rail — узкая карточка ленты «Популярные», без кнопки. */
  variant?: 'grid' | 'rail';
  eager?: boolean;
  /** Свой обработчик «Забронировать» (быстрый путь «Нужен байк сейчас»); без него — оформление или карточка. */
  onBook?: (model: ModelCard) => void;
}

/** Клиент указал, что прав нет, а для этой модели они нужны. */
export function needsLicense(model: Pick<ModelCard, 'engineCc' | 'licenseRequired'>, licenseCategory: LicenseCategory | null | undefined): boolean {
  return !licenseAllows(model, licenseCategory);
}

/** Карточка байка: фото, год, объём, рейтинг, цена в день, итог, «Забронировать», сердечко. */
export function ModelCardView({ model, range, link, timezone = DEFAULT_TIMEZONE, variant = 'grid', eager, onBook }: ModelCardViewProps) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language as Lang;
  const navigate = useNavigate();
  const { user } = useApp();
  const display = useDisplayCurrency();
  const { favorite, toggle } = useFavorite(model.id, model.isFavorite);
  const rating = ratingView(model);
  const busy = !!range && !model.available;
  const alt = (model.photo?.alt && pickText(model.photo.alt, lang)) || model.name;
  const meta = [model.year, model.engineCc ? t('catalog.card.cc', { cc: model.engineCc }) : t('catalog.card.electric')].filter(Boolean).join(' · ');

  const book = () => (onBook && range && model.available ? onBook(model) : navigate(range && model.available ? link(checkoutPath(model.id)) : link(bikePath(model.id))));

  return (
    <article className={cn('flex min-w-0 flex-col gap-2', variant === 'rail' && 'w-40 flex-none snap-start')}>
      <div className="relative">
        <Link to={link(bikePath(model.id))} aria-label={model.name} tabIndex={-1}>
          <ModelImage
            photo={model.photo}
            alt={alt}
            sizes={variant === 'rail' ? '160px' : '(max-width: 480px) 50vw, 240px'}
            eager={eager}
            dimmed={busy}
          />
        </Link>
        <span className="absolute right-2 top-2">
          <IconButton
            icon={Heart}
            variant="float"
            pressed={favorite}
            label={favorite ? t('catalog.card.favoriteRemove', { name: model.name }) : t('catalog.card.favoriteAdd', { name: model.name })}
            onClick={toggle}
          />
        </span>
        {needsLicense(model, user.licenseCategory) && (
          <Badge tone="warning" plain className="absolute bottom-2 left-2">
            {t('catalog.card.needLicense')}
          </Badge>
        )}
      </div>

      <div className="flex min-w-0 flex-col gap-0.5">
        <Link to={link(bikePath(model.id))} className="truncate text-body-strong" data-allow-truncate title={model.name}>
          {model.name}
        </Link>
        <div className="flex flex-wrap items-center gap-x-2 text-caption text-ink-muted">
          <span>{meta}</span>
          {rating.show && (
            <span
              className="inline-flex items-center gap-0.5 text-ink"
              aria-label={rating.showCount ? t('catalog.card.ratingLabel', { rating: model.rating, count: model.reviewsCount }) : `${model.rating} (${t('bike.ratingDemo')})`}
            >
              <Icon icon={Star} size={16} filled className="text-rating" />
              <span className="tabular text-label">{model.rating?.toFixed(1)}</span>
              {rating.demo && <span className="text-label text-ink-muted">{t('bike.ratingDemo')}</span>}
            </span>
          )}
        </div>
        {model.pointName && <span className="truncate text-caption text-ink-muted" data-allow-truncate>{pickText(model.pointName, lang)}</span>}
        <PriceText vnd={model.pricePerDay} lang={lang} display={display} suffix={t('catalog.card.perDay')} className="mt-1" />
        {model.total !== null && model.days !== null && (
          <span className="tabular text-caption text-ink-muted">
            {t('catalog.card.total', { days: model.days, price: formatPrice(model.total, lang, display) })}
          </span>
        )}
      </div>

      {variant === 'grid' &&
        (busy ? (
          <Button size="sm" variant="secondary" block disabled>
            {model.busyUntil
              ? t('catalog.card.busyUntil', { date: formatShortDate(new Date(model.busyUntil), lang, timezone) })
              : t('catalog.card.busy')}
          </Button>
        ) : (
          <Button size="sm" variant="inverse" block onClick={book}>
            {t('catalog.card.book')}
          </Button>
        ))}
      {variant === 'rail' && busy && (
        <span className="text-caption text-ink-muted">
          {model.busyUntil ? t('catalog.card.busyUntil', { date: formatShortDate(new Date(model.busyUntil), lang, timezone) }) : t('catalog.card.busy')}
        </span>
      )}
    </article>
  );
}
