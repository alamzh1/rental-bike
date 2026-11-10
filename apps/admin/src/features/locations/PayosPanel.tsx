import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { AdminLocation, AdminLocationPayos, AdminLocationPayosInput } from '@rental/shared';
import { Badge, Button, type BadgeTone } from '@rental/ui';
import { api } from '@/app/providers';
import { Alert, Field, inputClass } from '@/app/ui';
import { useAdminSave } from '@/features/fleet/kit';

const TONE: Record<AdminLocationPayos['account'], BadgeTone> = { own: 'success', platform: 'neutral', test: 'warning', off: 'warning' };
const EMPTY: AdminLocationPayosInput = { clientId: '', apiKey: '', checksumKey: '' };

/** Счёт оплаты точки: ключи канала payOS. Сервер их проверяет у payOS и обратно не отдаёт: поля всегда пустые. */
export function PayosPanel({ locationId, payos, onChanged }: { locationId: string; payos: AdminLocationPayos; onChanged: (l: AdminLocation) => void }) {
  const { t } = useTranslation();
  const [d, setD] = useState<AdminLocationPayosInput>(EMPTY);
  const [editing, setEditing] = useState(false);
  const url = `/admin/locations/${locationId}/payos`;
  const save = useAdminSave((v: AdminLocationPayosInput) => api.put<AdminLocation>(url, v).then((r) => (onChanged(r), r)), { success: t('admin-fleet.locations.payos.saved'), invalidate: ['/admin/locations'] });
  const clear = useAdminSave((_: undefined) => api.del<AdminLocation>(url).then((r) => (onChanged(r), r)), { success: t('admin-fleet.locations.payos.cleared'), invalidate: ['/admin/locations'] });
  const field = (k: keyof AdminLocationPayosInput, label: string, secret: boolean) => (
    <Field label={label} htmlFor={`${locationId}-${k}`}>
      <input id={`${locationId}-${k}`} type={secret ? 'password' : 'text'} autoComplete="off" spellCheck={false} value={d[k]} onChange={(e) => setD({ ...d, [k]: e.target.value })} className={inputClass} />
    </Field>
  );
  const valid = d.clientId.trim() && d.apiKey.trim() && d.checksumKey.trim();
  return (
    <section aria-labelledby={`${locationId}-payos`} className="flex flex-col gap-3">
      <h3 id={`${locationId}-payos`} className="text-headline">
        {t('admin-fleet.locations.payos.title')}
      </h3>
      <p className="flex flex-wrap items-center gap-2 text-body">
        <Badge tone={TONE[payos.account]}>{t(`admin-fleet.locations.payos.account.${payos.account}`)}</Badge>
        {payos.clientId && <span className="break-all text-caption text-ink-muted tabular">Client ID {payos.clientId}</span>}
      </p>
      <p className="text-caption text-ink-muted">{t(`admin-fleet.locations.payos.note.${payos.account}`)}</p>
      {payos.account === 'own' && !payos.webhookConfirmedAt && (
        <Alert tone="warning">
          {t('admin-fleet.locations.payos.webhookManual')} <span className="break-all tabular">{payos.webhookUrl}</span>
        </Alert>
      )}
      {(save.error ?? clear.error) && <Alert>{save.error ?? clear.error}</Alert>}
      {editing ? (
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (valid) {
              save.mutate(
                { clientId: d.clientId.trim(), apiKey: d.apiKey.trim(), checksumKey: d.checksumKey.trim() },
                {
                  onSuccess: () => {
                    setD(EMPTY);
                    setEditing(false);
                  },
                },
              );
            }
          }}
        >
          {field('clientId', 'Client ID', false)}
          {field('apiKey', 'API Key', true)}
          {field('checksumKey', 'Checksum Key', true)}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" loading={save.isLoading} disabled={!valid}>
              {t('admin-fleet.locations.payos.check')}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
              {t('admin-fleet.locations.payos.cancel')}
            </Button>
          </div>
        </form>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => setEditing(true)}>
            {t(payos.account === 'own' ? 'admin-fleet.locations.payos.replace' : 'admin-fleet.locations.payos.connect')}
          </Button>
          {payos.account === 'own' && (
            <Button variant="ghost" loading={clear.isLoading} onClick={() => window.confirm(t('admin-fleet.locations.payos.clearConfirm')) && clear.mutate(undefined)}>
              {t('admin-fleet.locations.payos.clear')}
            </Button>
          )}
        </div>
      )}
    </section>
  );
}
