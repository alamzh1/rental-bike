import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Compass, Lock } from 'lucide-react';
import { EmptyState } from '@rental/ui';

export function NotFound() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  return (
    <div className="flex flex-1 flex-col justify-center px-4">
      <EmptyState
        icon={Compass}
        title={t('common.notFound.title')}
        text={t('common.notFound.text')}
        action={{ label: t('common.actions.toHome'), onClick: () => navigate('/', { replace: true }) }}
      />
    </div>
  );
}

export function Forbidden() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  return (
    <div className="flex flex-1 flex-col justify-center px-4">
      <EmptyState
        icon={Lock}
        title={t('common.forbidden.title')}
        text={t('common.forbidden.text')}
        action={{ label: t('common.actions.toHome'), onClick: () => navigate('/', { replace: true }) }}
      />
    </div>
  );
}
