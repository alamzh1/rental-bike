import { useTranslation } from 'react-i18next';
import { Hammer } from 'lucide-react';
import type { AdminSection } from '@rental/shared';
import { EmptyState } from '@rental/ui';
import { PageHeader } from './ui';

/** Заглушка раздела, который наполняет таск 11. */
export function SectionStub({ section }: { section: AdminSection }) {
  const { t } = useTranslation();
  const name = t(`admin.nav.${section}`);
  return (
    <>
      <PageHeader title={name} />
      <EmptyState icon={Hammer} title={t('admin.stub.title', { section: name })} text={t('admin.stub.text')} className="py-16" />
    </>
  );
}
