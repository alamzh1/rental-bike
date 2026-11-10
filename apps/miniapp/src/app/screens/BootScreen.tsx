import { Skeleton } from '@rental/ui';

/** Пока идёт вход: скелетон по форме главной (приветствие, даты, чипы, карточки 2 в ряд). */
export function BootScreen({ label }: { label: string }) {
  return (
    <div aria-busy="true" aria-label={label} className="mx-auto flex max-w-app flex-col gap-4 px-4 pt-[calc(var(--safe-top)+theme(spacing.6))]">
      <Skeleton shape="text" className="h-7 w-3/5" />
      <Skeleton className="h-control-lg w-full rounded-md" />
      <div className="flex gap-2">
        {[64, 88, 72, 80].map((w) => (
          <Skeleton key={w} className="h-control-sm rounded-pill" style={{ width: w }} />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex flex-col gap-2">
            <Skeleton className="aspect-[4/3] w-full rounded-lg" />
            <Skeleton shape="text" className="w-4/5" />
            <Skeleton shape="text" className="w-1/2" />
          </div>
        ))}
      </div>
    </div>
  );
}
