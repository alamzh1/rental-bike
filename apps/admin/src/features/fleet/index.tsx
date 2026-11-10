import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { canSeeMoney } from '@rental/shared';
import { Chip, ChipGroup } from '@rental/ui';
import { PageHeader, useMe } from '@/app/ui';
import { Models } from './Models';
import { Bikes } from './Bikes';
import { Brands } from './Brands';

const TABS = ['models', 'bikes', 'brands'] as const;
type Tab = (typeof TABS)[number];

/** Парк: модели (фото, тексты на 3 языках, характеристики, депозит), байки (номер, VIN, пробег, статус, ТО, страховка, документы), бренды. */
export default function Fleet() {
  const { t } = useTranslation();
  const me = useMe();
  const [params, setParams] = useSearchParams();
  const tab: Tab = (TABS as readonly string[]).includes(params.get('tab') ?? '') ? (params.get('tab') as Tab) : 'models';
  // Модели и байки своей точки правит и владелец; бренды — справочник на все точки, он за администратором
  const canEdit = canSeeMoney(me.role);

  return (
    <>
      <PageHeader title={t('admin.nav.fleet')} meta={canEdit ? t('admin-fleet.fleet.meta') : t('admin-fleet.fleet.metaManager')} />
      <ChipGroup label={t('admin-fleet.fleet.tabs')} scroll className="mb-5 flex gap-2">
        {TABS.map((k) => (
          <Chip key={k} selected={tab === k} onClick={() => setParams(k === 'models' ? '' : `tab=${k}`, { replace: true })}>
            {t(`admin-fleet.fleet.tab.${k}`)}
          </Chip>
        ))}
      </ChipGroup>
      {tab === 'models' && <Models isAdmin={canEdit} />}
      {tab === 'bikes' && <Bikes isAdmin={canEdit} />}
      {tab === 'brands' && <Brands isAdmin={me.role === 'ADMIN'} />}
    </>
  );
}
