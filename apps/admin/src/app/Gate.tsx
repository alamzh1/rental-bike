import { CanAccess } from '@refinedev/core';
import { useTranslation } from 'react-i18next';
import { Lock } from 'lucide-react';
import type { AdminSection } from '@rental/shared';
import { EmptyState } from '@rental/ui';
import type { ReactNode } from 'react';
import { useMe } from './ui';

/** Раздел виден только роли, которой он открыт (canOpenSection). Менеджер на /settings видит объяснение, не пустоту. */
export function SectionGate({ section, children }: { section: AdminSection; children: ReactNode }) {
  const { t } = useTranslation();
  const owner = useMe().role === 'OWNER';
  return (
    <CanAccess resource={section} action="list" fallback={<EmptyState icon={Lock} title={t(owner ? 'admin.forbidden.ownerTitle' : 'admin.forbidden.title')} text={t(owner ? 'admin.forbidden.ownerText' : 'admin.forbidden.text')} className="py-16" />}>
      {children}
    </CanAccess>
  );
}
