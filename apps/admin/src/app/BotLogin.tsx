import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { AdminLoginLink, AdminLoginLinkStatus } from '@rental/shared';
import { Button, QrCode } from '@rental/ui';
import { chosenLang } from './i18n';
import { api } from './providers';
import { Alert } from './ui';

const POLL_MS = 2_000;

/** Вход через бота: кнопка на этом устройстве или QR для телефона, подтверждение в чате. Номер телефона не нужен. */
export function BotLogin({ onConfirmed }: { onConfirmed: () => void }) {
  const { t, i18n } = useTranslation();
  const [link, setLink] = useState<AdminLoginLink | null>(null);
  const [failed, setFailed] = useState(false);
  const [denied, setDenied] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const done = useRef(onConfirmed);
  done.current = onConfirmed;

  const create = useCallback(() => {
    setFailed(false);
    setDenied(false);
    setWaiting(false);
    api.post<AdminLoginLink>('/admin/auth/link', { lang: chosenLang() ?? undefined }).then(setLink, () => setFailed(true));
  }, []);

  // Новый язык на странице: бот должен спросить подтверждение уже на нём
  useEffect(create, [create, i18n.language]);

  useEffect(() => {
    if (!link) return;
    let stop = false;
    const id = window.setInterval(() => {
      api.post<AdminLoginLinkStatus>('/admin/auth/link/status', { secret: link.secret }).then(
        (r) => {
          if (stop) return;
          if (r.status === 'confirmed') {
            stop = true;
            window.clearInterval(id);
            done.current();
          } else if (r.status === 'denied') {
            stop = true;
            window.clearInterval(id);
            setLink(null);
            setDenied(true);
          } else if (r.status === 'expired') {
            // Ссылка живёт 5 минут: страница сама получает новую, чтобы QR всегда работал
            stop = true;
            window.clearInterval(id);
            create();
          }
        },
        () => undefined, // сбой сети: следующий опрос попробует снова
      );
    }, POLL_MS);
    return () => {
      stop = true;
      window.clearInterval(id);
    };
  }, [link, create]);

  if (denied) {
    return (
      <div className="flex flex-col gap-3">
        <Alert>{t('admin.login.forbidden')}</Alert>
        <Button variant="secondary" onClick={create}>{t('admin.login.retry')}</Button>
      </div>
    );
  }
  if (failed) {
    return (
      <div className="flex flex-col gap-3">
        <Alert>{t('admin.login.failed')}</Alert>
        <Button variant="secondary" onClick={create}>{t('admin.login.retry')}</Button>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-4" aria-busy={!link || undefined}>
      <a
        href={link?.url}
        target="_blank"
        rel="noreferrer"
        onClick={() => setWaiting(true)}
        aria-disabled={!link}
        className="flex h-control-lg items-center justify-center rounded-md bg-accent px-4 text-body-strong text-on-accent"
      >
        {t('admin.login.botButton')}
      </a>
      {waiting && <p role="status" className="text-caption text-ink-muted">{t('admin.login.waiting')}</p>}
      <div className="flex items-center gap-4 rounded-md bg-surface p-3">
        {link ? <QrCode value={link.url} label={t('admin.login.qrLabel')} className="h-[112px] w-[112px] flex-none rounded-xs" /> : <div className="h-[112px] w-[112px] flex-none" />}
        <p className="min-w-0 text-caption text-ink-muted">{t('admin.login.qrHint')}</p>
      </div>
    </div>
  );
}
