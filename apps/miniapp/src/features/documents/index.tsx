import { useTranslation } from 'react-i18next';
import { DocumentSlots } from './DocumentSlots';

/** Документы клиента: те же карточки, что в оформлении; без паспорта и прав бронь не создаётся. */
export default function DocumentsScreen() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-6 px-4 pt-2">
      <header className="flex flex-col gap-1">
        <h1 className="m-0 text-title-1 text-balance">{t('profile.documents.title')}</h1>
        <p className="m-0 text-body text-ink-muted">{t('profile.documents.intro')}</p>
      </header>
      <DocumentSlots />
    </div>
  );
}
