import { useTranslation } from 'react-i18next';
import { RefreshCw } from 'lucide-react';
import { EmptyState } from '@rental/ui';
import { errorKey } from '../../features/checkout/errors';

/** Вход не удался: что случилось (errors.<code>) и одна кнопка «Повторить». */
export function ErrorScreen({ code, onRetry }: { code: string; onRetry: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="mx-auto flex min-h-dvh max-w-app flex-col justify-center px-4">
      <EmptyState
        tone="danger"
        icon={RefreshCw}
        title={t('common.boot.errorTitle')}
        text={t(errorKey(code))}
        action={{ label: t('common.actions.retry'), onClick: onRetry }}
      />
    </div>
  );
}
