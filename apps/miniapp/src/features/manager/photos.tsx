import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Camera, RotateCw, X } from 'lucide-react';
import { Icon, cn } from '@rental/ui';
import { useApp } from '@/app/context';
import { uploadActPhoto } from './api';

// Фото акта: снимок камерой или из галереи, загрузка сразу в приватный бакет, в акт уходят только ключи.

export interface PhotoItem {
  id: string;
  preview: string;
  file: File;
  state: 'uploading' | 'done' | 'failed';
  key?: string;
}

export function usePhotos(bookingId: string, max: number) {
  const { api } = useApp();
  const [items, setItems] = useState<PhotoItem[]>([]);
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const seq = useRef(0);

  const patch = useCallback((id: string, p: Partial<PhotoItem>) => setItems((list) => list.map((i) => (i.id === id ? { ...i, ...p } : i))), []);

  const send = useCallback(
    (item: PhotoItem) => {
      patch(item.id, { state: 'uploading' });
      uploadActPhoto(api, bookingId, item.file).then(
        (key) => patch(item.id, { state: 'done', key }),
        () => patch(item.id, { state: 'failed' }),
      );
    },
    [api, bookingId, patch],
  );

  const add = useCallback(
    (files: FileList | File[]) => {
      const room = max - itemsRef.current.length;
      const added = Array.from(files)
        .slice(0, Math.max(0, room))
        .map((file): PhotoItem => ({ id: `p${seq.current++}`, preview: URL.createObjectURL(file), file, state: 'uploading' }));
      if (!added.length) return;
      setItems((list) => [...list, ...added]);
      added.forEach(send);
    },
    [max, send],
  );

  const remove = useCallback((id: string) => {
    setItems((list) => {
      const gone = list.find((i) => i.id === id);
      if (gone) URL.revokeObjectURL(gone.preview);
      return list.filter((i) => i.id !== id);
    });
  }, []);

  useEffect(() => () => itemsRef.current.forEach((i) => URL.revokeObjectURL(i.preview)), []);

  return {
    items,
    add,
    remove,
    retry: (id: string) => {
      const item = itemsRef.current.find((i) => i.id === id);
      if (item) send(item);
    },
    keys: items.filter((i) => i.state === 'done' && i.key).map((i) => i.key as string),
    uploading: items.some((i) => i.state === 'uploading'),
    failed: items.some((i) => i.state === 'failed'),
  };
}

export type PhotosState = ReturnType<typeof usePhotos>;

/** Сетка миниатюр 4 в ряд и плитка «Добавить фото». Камера по умолчанию — задняя. */
export function PhotoGrid({ photos, max, label }: { photos: PhotosState; max: number; label: string }) {
  const { t } = useTranslation();
  const input = useRef<HTMLInputElement>(null);
  return (
    <div className="flex flex-col gap-2">
      <ul className="m-0 grid list-none grid-cols-4 gap-2 p-0" aria-label={label}>
        {photos.items.map((p) => (
          <li key={p.id} className="relative aspect-square overflow-hidden rounded-sm bg-surface">
            <img src={p.preview} alt="" className={cn('h-full w-full object-cover', p.state !== 'done' && 'opacity-50')} />
            {p.state === 'uploading' && <span className="absolute inset-0 grid place-items-center text-caption font-bold text-ink">{t('manager.photo.uploading')}</span>}
            {p.state === 'failed' && (
              <button type="button" onClick={() => photos.retry(p.id)} className="hit-44 absolute inset-0 grid place-items-center bg-danger-soft text-danger" aria-label={t('manager.photo.retry')}>
                <Icon icon={RotateCw} size={20} />
              </button>
            )}
            <button
              type="button"
              onClick={() => photos.remove(p.id)}
              className="hit-44 absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-inverse text-on-inverse"
              aria-label={t('manager.photo.remove')}
            >
              <Icon icon={X} size={16} />
            </button>
          </li>
        ))}
        {photos.items.length < max && (
          <li className="aspect-square">
            <button
              type="button"
              onClick={() => input.current?.click()}
              className="flex h-full w-full flex-col items-center justify-center gap-1 rounded-sm border border-dashed border-line-strong bg-bg px-1 text-center text-caption font-semibold text-ink"
            >
              <Icon icon={Camera} size={20} />
              <span>{t('manager.photo.add')}</span>
            </button>
          </li>
        )}
      </ul>
      <input
        ref={input}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        hidden
        onChange={(e) => {
          if (e.target.files) photos.add(e.target.files);
          e.target.value = '';
        }}
      />
      <p className="m-0 text-caption text-ink-muted tabular">{t('manager.photo.count', { count: photos.items.length, max })}</p>
    </div>
  );
}
