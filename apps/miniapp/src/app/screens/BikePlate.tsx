import { cn } from '@rental/ui';

// Контур байка из дизайн-системы (.br-photo) как маска: цвет берётся из токена, а не из SVG.
const OUTLINE =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 160 100' fill='none' stroke='black' stroke-width='3.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='34' cy='74' r='15'/%3E%3Ccircle cx='128' cy='74' r='15'/%3E%3Cpath d='M18 60c4-12 18-17 42-15l8 15-14 14H49'/%3E%3Cpath d='M30 41h34'/%3E%3Cpath d='M54 74h44l10-22'/%3E%3Cpath d='M128 74 112 22'/%3E%3Cpath d='M104 22h17'/%3E%3Cpath d='M112 34c-8 0-14 4-17 12'/%3E%3C/svg%3E\")";

/** Подложка фото байка: surface + контур, пока нет фото. src — фото поверх (WebP/AVIF от таска фото). */
export function BikePlate({ className, src, alt }: { className?: string; src?: string; alt?: string }) {
  return (
    <div className={cn('relative overflow-hidden rounded-xl bg-surface', className)}>
      {src ? (
        <img src={src} alt={alt ?? ''} className="absolute inset-0 h-full w-full object-contain p-6" decoding="async" />
      ) : (
        <div
          role={alt ? 'img' : undefined}
          aria-label={alt}
          className="absolute inset-[12%] bg-line-strong"
          style={{ maskImage: OUTLINE, WebkitMaskImage: OUTLINE, maskRepeat: 'no-repeat', WebkitMaskRepeat: 'no-repeat', maskPosition: 'center', WebkitMaskPosition: 'center', maskSize: 'contain', WebkitMaskSize: 'contain' }}
        />
      )}
    </div>
  );
}
