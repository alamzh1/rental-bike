import type { ModelPhoto } from '@rental/shared';
import { cn } from '@rental/ui';
import { BikePlate } from '@/app/screens/BikePlate';

/** srcset по ширинам из ModelPhoto.sizes: «url 400w, url 800w». Ширины — ключи словаря. */
export function buildSrcSet(sizes: ModelPhoto['sizes'], kind: 'webp' | 'avif'): string | null {
  const entries = Object.entries(sizes)
    .map(([width, s]) => ({ width: Number(width), url: s[kind] }))
    .filter((e): e is { width: number; url: string } => Number.isFinite(e.width) && !!e.url)
    .sort((a, b) => a.width - b.width);
  return entries.length ? entries.map((e) => `${e.url} ${e.width}w`).join(', ') : null;
}

export interface ModelImageProps {
  photo: ModelPhoto | null;
  alt: string;
  /** Подсказка браузеру, какой ширины картинка: выбирает размер из srcset. */
  sizes: string;
  /** Первый экран — без ленивой загрузки. */
  eager?: boolean;
  className?: string;
  /** Пропорции подложки: 4/3 в каталоге, 16/10 в галерее. */
  ratio?: 'card' | 'gallery';
  dimmed?: boolean;
}

/** Фото на серой подложке: AVIF → WebP через <picture>, без фото — контур байка. */
export function ModelImage({ photo, alt, sizes, eager, className, ratio = 'card', dimmed }: ModelImageProps) {
  const avif = photo ? buildSrcSet(photo.sizes, 'avif') : null;
  const webp = photo ? buildSrcSet(photo.sizes, 'webp') : null;
  return (
    <div
      className={cn(
        'relative w-full overflow-hidden rounded-lg bg-surface',
        ratio === 'card' ? 'aspect-[4/3]' : 'aspect-[16/10]',
        className,
      )}
    >
      {photo ? (
        <picture>
          {avif && <source type="image/avif" srcSet={avif} sizes={sizes} />}
          {webp && <source type="image/webp" srcSet={webp} sizes={sizes} />}
          <img
            src={photo.url}
            alt={alt}
            sizes={sizes}
            loading={eager ? 'eager' : 'lazy'}
            decoding="async"
            className={cn(
              // Фото студийные, на своём светлом фоне: в карточке (4:3, как сам кадр) — на всю подложку, без светлой рамки
              // внутри серой/тёмной; в галерее 16:10 — по высоте, чтобы не срезать зеркала и колёса.
              'absolute inset-0 h-full w-full transition-opacity duration-base',
              ratio === 'card' ? 'object-cover' : 'object-contain',
              dimmed && 'opacity-50 grayscale',
            )}
          />
        </picture>
      ) : (
        <BikePlate className={cn('h-full w-full', dimmed && 'opacity-50')} alt={alt} />
      )}
    </div>
  );
}
