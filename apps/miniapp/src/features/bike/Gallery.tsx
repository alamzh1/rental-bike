import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@rental/ui';
import type { Lang, ModelPhoto } from '@rental/shared';
import { pickText } from '@rental/i18n';
import { ModelImage } from '../catalog/ModelImage';

/** Галерея со свайпом (scroll-snap), счётчик «2 / 4» и точки. Первое фото — без ленивой загрузки. */
export function Gallery({ photos, name }: { photos: ModelPhoto[]; name: string }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language as Lang;
  const track = useRef<HTMLUListElement>(null);
  const [index, setIndex] = useState(0);
  const list: Array<ModelPhoto | null> = photos.length ? photos : [null];

  const onScroll = () => {
    const el = track.current;
    if (!el || el.clientWidth === 0) return;
    setIndex(Math.round(el.scrollLeft / el.clientWidth));
  };

  return (
    <div className="relative">
      <ul
        ref={track}
        onScroll={onScroll}
        aria-label={t('bike.gallery.label', { name })}
        className="no-scrollbar m-0 flex list-none snap-x snap-mandatory overflow-x-auto rounded-lg p-0"
      >
        {list.map((p, i) => (
          <li key={p?.url ?? 'none'} className="w-full flex-none snap-center" aria-label={t('bike.gallery.slide', { n: i + 1, total: list.length })}>
            <ModelImage
              photo={p}
              alt={(p?.alt && pickText(p.alt, lang)) || name}
              ratio="gallery"
              sizes="(max-width: 480px) 100vw, 480px"
              eager={i === 0}
              className="rounded-none"
            />
          </li>
        ))}
      </ul>
      {list.length > 1 && (
        <>
          <span className="tabular absolute bottom-3 left-3 rounded-pill bg-surface-raised px-2.5 py-0.5 text-label text-ink" aria-live="polite">
            {index + 1} / {list.length}
          </span>
          <span aria-hidden className="absolute bottom-4 right-3 flex gap-1">
            {list.map((_, i) => (
              <span key={i} className={cn('h-1.5 rounded-full transition-all duration-base ease-out', i === index ? 'w-4 bg-ink' : 'w-1.5 bg-line-strong')} />
            ))}
          </span>
        </>
      )}
    </div>
  );
}
