import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ImageOff } from 'lucide-react';
import { pickText } from '@rental/i18n';
import type { AdminBannerInput, AdminBannerResponse, I18nText, Lang } from '@rental/shared';
import { Button, Chip, ChipGroup, Icon } from '@rental/ui';
import { api } from '@/app/providers';
import { Alert, Field, inputClass, PageHeader, Panel } from '@/app/ui';
import { DemoTag, I18nTextField, ImagePicker, LANG_ORDER, LoadGate, uploadFile, useAdminGet, useAdminSave } from '@/features/fleet/kit';

type Draft = { title: Partial<I18nText>; text: Partial<I18nText>; link: string; isActive: boolean };

const clean = (t: Partial<I18nText>): I18nText | null => {
  const out = Object.fromEntries(Object.entries(t).filter(([, v]) => typeof v === 'string' && v.trim()).map(([k, v]) => [k, (v as string).trim()]));
  return Object.keys(out).length ? (out as I18nText) : null;
};

function BannerForm({ data }: { data: AdminBannerResponse }) {
  const { t } = useTranslation();
  const b = data.banner;
  const [d, setD] = useState<Draft>({ title: b?.title ?? {}, text: b?.text ?? {}, link: b?.link ?? '', isActive: b?.isActive ?? true });
  const [preview, setPreview] = useState<Lang>('ru');
  const save = useAdminSave((v: AdminBannerInput) => api.patch<AdminBannerResponse>('/admin/banner', v), { success: t('admin-fleet.common.saved'), invalidate: ['/admin/banner'] });
  const image = useAdminSave((file: File) => uploadFile<AdminBannerResponse>('/admin/banner/image', file), { success: t('admin-fleet.banner.imageSaved'), invalidate: ['/admin/banner'] });
  const current = image.data?.banner ?? save.data?.banner ?? b;
  const linkOk = !d.link.trim() || /^(https:\/\/|\/|tg:\/\/)/.test(d.link.trim());
  const valid = !!d.title.en?.trim() && linkOk;
  const title = clean(d.title);
  const text = clean(d.text);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <Panel title={t('admin-fleet.banner.content')} actions={<DemoTag show={!!current?.isDemo} />}>
        <div className="flex flex-col gap-4">
          {save.error && <Alert>{save.error}</Alert>}
          <I18nTextField label={t('admin-fleet.banner.title')} value={d.title} onChange={(title) => setD({ ...d, title })} maxLength={80} />
          <I18nTextField label={t('admin-fleet.banner.text')} value={d.text} onChange={(text) => setD({ ...d, text })} multiline rows={2} maxLength={200} />
          <Field label={t('admin-fleet.banner.link')} htmlFor="banner-link" hint={t('admin-fleet.banner.linkHint')}>
            <input id="banner-link" value={d.link} maxLength={500} placeholder="https://" onChange={(e) => setD({ ...d, link: e.target.value })} className={inputClass} aria-invalid={!linkOk || undefined} />
          </Field>
          <label className="flex items-center gap-3 text-body">
            <input type="checkbox" checked={d.isActive} onChange={(e) => setD({ ...d, isActive: e.target.checked })} className="h-5 w-5 accent-[var(--accent)]" />
            {t('admin-fleet.banner.active')}
          </label>
          <div className="flex justify-end">
            <Button disabled={!valid} loading={save.isLoading} onClick={() => save.mutate({ title: title!, text, link: d.link.trim() || null, isActive: d.isActive })}>
              {t('admin-fleet.common.save')}
            </Button>
          </div>
        </div>
      </Panel>

      <Panel title={t('admin-fleet.banner.preview')}>
        <div className="flex flex-col gap-4">
          <ChipGroup label={t('admin-fleet.banner.previewLang')} className="flex gap-2">
            {LANG_ORDER.map((l) => (
              <Chip key={l} selected={preview === l} onClick={() => setPreview(l)}>
                {l.toUpperCase()}
              </Chip>
            ))}
          </ChipGroup>
          <div className={`flex min-h-[132px] items-stretch overflow-hidden rounded-lg bg-promo text-on-promo ${d.isActive ? '' : 'opacity-50'}`}>
            <div className="flex min-w-0 flex-1 flex-col justify-center gap-1 p-4">
              <p className="text-headline text-balance">{title ? pickText(title, preview) : t('admin-fleet.banner.titlePlaceholder')}</p>
              {text && <p className="text-caption">{pickText(text, preview)}</p>}
            </div>
            {current?.imageUrl ? (
              <img src={current.imageUrl} alt="" className="w-2/5 object-cover" />
            ) : (
              <span className="flex w-2/5 items-center justify-center">
                <Icon icon={ImageOff} size={24} />
              </span>
            )}
          </div>
          {!d.isActive && <p className="text-caption text-ink-muted">{t('admin-fleet.banner.hiddenHint')}</p>}
          {image.error && <Alert>{image.error}</Alert>}
          {current ? (
            <ImagePicker label={current.imageUrl ? t('admin-fleet.banner.replaceImage') : t('admin-fleet.banner.uploadImage')} loading={image.isLoading} onPick={(f) => image.mutate(f)} />
          ) : (
            <p className="text-caption text-ink-muted">{t('admin-fleet.banner.saveFirst')}</p>
          )}
        </div>
      </Panel>
    </div>
  );
}

/** Баннер главной Mini App: заголовок и текст на 3 языках, ссылка, изображение (WebP 1200). */
export default function Banner() {
  const { t } = useTranslation();
  const q = useAdminGet<AdminBannerResponse>('/admin/banner');
  return (
    <>
      <PageHeader title={t('admin.nav.banner')} meta={t('admin-fleet.banner.meta')} />
      <LoadGate isLoading={q.isLoading} isError={q.isError} onRetry={() => void q.refetch()} rows={3}>
        {q.data && <BannerForm key={q.data.banner?.id ?? 'new'} data={q.data} />}
      </LoadGate>
    </>
  );
}
