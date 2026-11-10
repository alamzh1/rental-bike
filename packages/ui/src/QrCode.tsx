import { useMemo } from 'react';
import { encodeQr } from './qr';

/** QR-код как SVG: модули — on-promo (тёмный в обеих темах), подложка — on-accent (белый в обеих): QR читается и в тёмной теме. */
export function QrCode({ value, label, className }: { value: string; label: string; className?: string }) {
  const { path, size } = useMemo(() => {
    const matrix = encodeQr(value);
    const quiet = 3;
    let d = '';
    matrix.forEach((row, y) => {
      let x = 0;
      while (x < row.length) {
        if (!row[x]) {
          x++;
          continue;
        }
        const start = x;
        while (x < row.length && row[x]) x++;
        d += `M${start + quiet} ${y + quiet}h${x - start}v1h${-(x - start)}z`;
      }
    });
    return { path: d, size: matrix.length + quiet * 2 };
  }, [value]);
  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`0 0 ${size} ${size}`}
      shapeRendering="crispEdges"
      className={className}
    >
      <rect width={size} height={size} style={{ fill: 'var(--on-accent)' }} />
      <path d={path} style={{ fill: 'var(--on-promo)' }} />
    </svg>
  );
}
