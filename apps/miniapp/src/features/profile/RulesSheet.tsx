import { useTranslation } from 'react-i18next';
import { Sheet } from '@rental/ui';
import { pickText } from '@rental/i18n';
import type { Lang } from '@rental/shared';
import { usePublicSettings } from './settings';

/** Правила аренды поверх текущего экрана: оформление не теряется. */
export function RulesSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const settings = usePublicSettings();
  const text = settings.data?.rulesText;
  return (
    <Sheet open={open} onClose={onClose} title={t('profile.help.rules')} closeLabel={t('common.actions.close')}>
      <p className="m-0 whitespace-pre-line pb-4 text-body">{text ? pickText(text, i18n.language as Lang) : t('profile.help.placeholder')}</p>
    </Sheet>
  );
}
