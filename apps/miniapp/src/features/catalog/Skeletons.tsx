import { Skeleton } from '@rental/ui';

/** Заглушка карточки каталога по форме будущей карточки. */
export function CardSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      <Skeleton className="aspect-[4/3] w-full !rounded-lg" />
      <Skeleton shape="text" className="w-3/4" />
      <Skeleton shape="text" className="w-1/2" />
      <Skeleton shape="text" className="w-2/3" />
      <Skeleton className="h-control-sm w-full" />
    </div>
  );
}

export function GridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div aria-busy="true" className="grid grid-cols-2 gap-3">
      {Array.from({ length: count }, (_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  );
}
