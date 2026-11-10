import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@rental/ui';
import { MainAction } from '@/app/shell/MainAction';
import { useTrack } from '../catalog/api';
import { DatesPicker } from './DatesPicker';
import { rangeToParams, type DateRange } from './range';
import { useDates } from './store';

/** Экран выбора дат (маршрут /dates; ?model=<id> — занятые для модели даты и итог под календарём). */
export default function DatesScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const modelId = params.get('model') ?? undefined;
  const { range, setRange } = useDates();
  const track = useTrack();
  const [draft, setDraft] = useState<DateRange | null>(null);
  const [pickerKey, setPickerKey] = useState(0);

  const apply = () => {
    if (!draft) return;
    setRange(draft);
    track('dates_selected', { from: draft.from, to: draft.to, source: 'screen' });
    const search = rangeToParams(draft).toString();
    navigate(modelId ? `/bikes/${encodeURIComponent(modelId)}?${search}` : `/catalog?${search}`);
  };

  return (
    <div className="flex flex-col gap-4 px-4 pt-2">
      <div className="flex items-start justify-between gap-3">
        <h1 className="m-0 text-title-1 text-balance">{t('dates.title')}</h1>
        {range && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setRange(null);
              setPickerKey((k) => k + 1);
            }}
          >
            {t('dates.clear')}
          </Button>
        )}
      </div>
      <DatesPicker key={pickerKey} modelId={modelId} initial={range} onChange={setDraft} />
      <MainAction text={modelId ? t('dates.apply.model') : t('dates.apply.catalog')} onClick={apply} disabled={!draft} />
    </div>
  );
}
