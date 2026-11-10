import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Hammer } from 'lucide-react';
import { EmptyState } from '@rental/ui';

/** Заглушка экрана, пока таск фичи не наполнил свою папку. */
export function FeatureStub() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  return (
    <div className="flex flex-1 flex-col justify-center px-4">
      <EmptyState
        icon={Hammer}
        title={t('common.stub.title')}
        text={t('common.stub.text')}
        action={{ label: t('common.actions.toHome'), onClick: () => navigate('/') }}
      />
    </div>
  );
}
