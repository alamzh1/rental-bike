import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@rental/ui';
import { LANGS, type Lang } from '@rental/shared';
import { errorKey } from '../../features/checkout/errors';
import { useApp, useHaptic } from '../context';
import { getI18n } from '../i18n';
import { ApiRequestError } from '../session/api';

const NATIVE: Record<Lang, string> = { ru: 'Русский', en: 'English', vi: 'Tiếng Việt' };
const TITLE: Record<Lang, string> = { ru: 'Выберите язык', en: 'Choose your language', vi: 'Chọn ngôn ngữ' };

/** Самый первый экран: язык выбирается до всего остального. Заголовок на всех языках: читатель может не знать текущий. */
export function LanguageScreen() {
  const { user, updateMe } = useApp();
  const { t } = useTranslation();
  const haptic = useHaptic();
  const [busy, setBusy] = useState<Lang | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Язык Telegram — первым и главной кнопкой: чаще всего он и нужен
  const order = [user.lang, ...LANGS.filter((l) => l !== user.lang)];

  const choose = async (lang: Lang) => {
    haptic.selection();
    setBusy(lang);
    setError(null);
    getI18n(lang);
    try {
      await updateMe({ lang });
    } catch (e) {
      setError(e instanceof ApiRequestError ? e.code : 'UNKNOWN');
      setBusy(null);
    }
  };

  return (
    <div className="mx-auto flex min-h-dvh max-w-app flex-col justify-center gap-6 px-4 pb-8 pt-[calc(var(--safe-top)+theme(spacing.4))]">
      <div className="flex flex-col gap-1">
        {order.map((l, i) => (
          <p key={l} lang={l} className={i === 0 ? 'm-0 text-display text-balance' : 'm-0 text-body text-ink-muted'}>
            {TITLE[l]}
          </p>
        ))}
      </div>
      <div className="flex flex-col gap-3">
        {order.map((l, i) => (
          <Button key={l} block size="lg" variant={i === 0 ? 'primary' : 'secondary'} lang={l} loading={busy === l} disabled={!!busy && busy !== l} onClick={() => void choose(l)}>
            {NATIVE[l]}
          </Button>
        ))}
      </div>
      {error && (
        <p role="alert" className="m-0 rounded-md bg-danger-soft px-4 py-3 text-caption text-danger">
          {t(errorKey(error))}
        </p>
      )}
    </div>
  );
}
