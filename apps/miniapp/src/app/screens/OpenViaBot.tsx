import { useTranslation } from 'react-i18next';
import { Send } from 'lucide-react';
import { EmptyState } from '@rental/ui';
import { BOT_USERNAME } from '../env';

/** Открыто вне Telegram и без DEV_AUTH: API не вызывается, только ссылка на бота. */
export function OpenViaBot() {
  const { t } = useTranslation();
  const link = BOT_USERNAME ? `https://t.me/${BOT_USERNAME}` : null;
  return (
    <div className="mx-auto flex min-h-dvh max-w-app flex-col justify-center px-4 py-8">
      <EmptyState
        icon={Send}
        title={t('common.outside.title')}
        text={t('common.outside.text')}
        action={link ? { label: t('common.outside.action'), onClick: () => window.location.assign(link) } : undefined}
      />
    </div>
  );
}
