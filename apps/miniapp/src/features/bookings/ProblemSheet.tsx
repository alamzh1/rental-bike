import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation } from '@tanstack/react-query';
import { Button, Chip, ChipGroup, Sheet } from '@rental/ui';
import type { Booking } from '@rental/shared';
import { useApp, useHaptic } from '@/app/context';
import { errorCode, errorKey } from '../checkout/errors';
import { useRefreshBookings } from './api';

const HINTS = ['wontStart', 'accident', 'lostKey', 'flatTire', 'other'] as const;

/** «Сообщить о проблеме»: подсказки-чипы подставляют текст, комментарий можно дописать. */
export function ProblemSheet({ booking: b, open, onClose, contact }: { booking: Booking; open: boolean; onClose: () => void; contact: string | null }) {
  const { t } = useTranslation();
  const { api } = useApp();
  const haptic = useHaptic();
  const refresh = useRefreshBookings();
  const [comment, setComment] = useState('');
  const [hint, setHint] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const send = useMutation({
    mutationFn: () => api.request<unknown>(`/bookings/${b.id}/problem`, { method: 'POST', json: { comment: comment.trim() || undefined } }),
    onSuccess: () => {
      haptic.notification('success');
      setSent(true);
      refresh(b.id);
    },
    onError: () => haptic.notification('error'),
  });
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t('bookings.problemSheet.title')}
      closeLabel={t('common.actions.close')}
      footer={
        sent ? (
          <Button block variant="secondary" onClick={onClose}>{t('common.actions.close')}</Button>
        ) : (
          <Button block loading={send.isPending} onClick={() => send.mutate()}>{t('bookings.problemSheet.send')}</Button>
        )
      }
    >
      {sent ? (
        <p className="m-0 pb-2 text-body">{t('bookings.problemSheet.sent')}</p>
      ) : (
        <div className="flex flex-col gap-3 pb-2">
          <p className="m-0 text-body text-ink-muted">{t('bookings.problemSheet.text')}</p>
          <ChipGroup label={t('bookings.problemSheet.hints')}>
            {HINTS.map((h) => (
              <Chip
                key={h}
                selected={hint === h}
                onClick={() => {
                  haptic.selection();
                  setHint(h);
                  setComment(t(`bookings.problemSheet.hint.${h}`));
                }}
              >
                {t(`bookings.problemSheet.hint.${h}`)}
              </Chip>
            ))}
          </ChipGroup>
          <label className="flex flex-col gap-1">
            <span className="text-caption font-semibold text-ink-muted">{t('bookings.problemSheet.comment')}</span>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={4}
              maxLength={1000}
              className="w-full resize-none rounded-md border border-line-strong bg-bg p-3 text-body text-ink"
            />
          </label>
          {contact && <p className="m-0 text-caption text-ink-muted">{t('bookings.problemSheet.contactHint')}</p>}
          {send.isError && <p role="alert" className="m-0 text-caption text-danger">{t(errorKey(errorCode(send.error)))}</p>}
        </div>
      )}
    </Sheet>
  );
}
