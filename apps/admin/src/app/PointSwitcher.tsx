import { useTranslation } from 'react-i18next';
import { pickText } from '@rental/i18n';
import type { AdminListOf, AdminLocation, Lang } from '@rental/shared';
import { useAdminGet } from '@/features/fleet/kit';
import { selectedPoint, selectPoint } from './api';
import { Field, inputClass, useMe } from './ui';

/** Администратор смотрит все точки сразу или одну: выбранная сужает все разделы и туда же попадает всё новое. */
export function PointSwitcher() {
  const { t, i18n } = useTranslation();
  const me = useMe();
  const q = useAdminGet<AdminListOf<AdminLocation>>('/admin/locations', undefined, me.role === 'ADMIN');
  const points = q.data?.items ?? [];
  if (me.role !== 'ADMIN' || points.length < 2) return null;
  const change = (id: string) => {
    selectPoint(id || null);
    // Данные всех разделов зависят от точки: перезагрузка дешевле, чем следить за каждым кэшем
    window.location.reload();
  };
  return (
    <div className="mb-4 max-w-[360px]">
      <Field label={t('admin.point.label')} htmlFor="point-switch">
        <select id="point-switch" value={selectedPoint() ?? ''} onChange={(e) => change(e.target.value)} className={inputClass}>
          <option value="">{t('admin.point.all')}</option>
          {points.map((l) => (
            <option key={l.id} value={l.id}>
              {pickText(l.name, i18n.language as Lang)}
            </option>
          ))}
        </select>
      </Field>
    </div>
  );
}
