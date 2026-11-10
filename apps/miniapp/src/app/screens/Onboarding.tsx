import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { errorKey } from '../../features/checkout/errors';
import { useApp } from '../context';
import { ApiRequestError } from '../session/api';
import { MainAction } from '../shell/MainAction';
import { BikePlate } from './BikePlate';

/** Первый запуск после выбора языка: фото байка, заголовок, «Начать». Флаг onboardedAt — на сервере. */
export function Onboarding() {
  const { updateMe } = useApp();
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = async () => {
    setBusy(true);
    setError(null);
    try {
      await updateMe({ onboarded: true });
    } catch (e) {
      setError(e instanceof ApiRequestError ? e.code : 'UNKNOWN');
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-dvh max-w-app flex-col px-4 pt-[calc(var(--safe-top)+theme(spacing.4))]">
      <p className="m-0 text-headline">{t('common.appName')}</p>
      <BikePlate className="mt-4 min-h-[220px] flex-1" alt={t('onboarding.photoAlt')} />
      <h1 className="m-0 mt-6 text-display text-balance">{t('onboarding.title')}</h1>
      <p className="m-0 mt-2 text-body text-ink-muted">{t('onboarding.text')}</p>
      {error && (
        <p role="alert" className="m-0 mt-4 rounded-md bg-danger-soft px-4 py-3 text-caption text-danger">
          {t(errorKey(error))}
        </p>
      )}
      <div className="h-6" />
      <MainAction text={t('onboarding.start')} onClick={start} loading={busy} />
    </div>
  );
}
