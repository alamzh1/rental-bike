import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Sheet, Skeleton } from '@rental/ui';
import { formatDate, formatPrice, formatTime } from '@rental/i18n';
import type { Booking, Lang, ModelCard, Quote } from '@rental/shared';
import { useApp, useHaptic } from '@/app/context';
import { paths } from '@/app/router';
import { errorCode, errorKey } from '../checkout/errors';
import { buildBookingRequest } from '../checkout/request';
import type { DateRange } from '../dates/range';
import { RulesSheet } from '../profile/RulesSheet';
import { useDisplayCurrency } from '../profile/settings';

/**
 * Быстрый путь «Нужен байк сейчас» для клиента с сохранёнными телефоном и документами (история 70):
 * выбор байка → «Согласен, оплатить» → экран оплаты. Согласие с правилами — само нажатие на кнопку с видимым текстом.
 */
export function NowQuickSheet({ model, range, timezone, onClose }: { model: ModelCard | null; range: DateRange; timezone: string; onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const [rulesOpen, setRulesOpen] = useState(false);
  const queryClient = useQueryClient();
  const lang = i18n.language as Lang;
  const navigate = useNavigate();
  const haptic = useHaptic();
  const { api, user } = useApp();
  const display = useDisplayCurrency();

  const quote = useQuery({
    queryKey: ['now-quote', model?.id, range.from, range.to],
    queryFn: () => api.request<Quote>('/quotes', { method: 'POST', json: { modelId: model!.id, startAt: range.from, endAt: range.to, extras: [] } }),
    enabled: !!model,
  });
  const create = useMutation({
    mutationFn: () =>
      api.request<Booking>('/bookings', {
        method: 'POST',
        json: buildBookingRequest({ modelId: model!.id, range, extras: {}, method: 'VIETQR', phone: user.phone ?? '', agreed: true, delivery: false, address: '' }),
      }),
    onSuccess: (booking) => {
      haptic.notification('success');
      void queryClient.invalidateQueries({ queryKey: ['bookings'] });
      navigate(paths.payment(booking.id), { replace: true });
    },
    onError: () => haptic.notification('error'),
  });

  const from = new Date(range.from);
  const to = new Date(range.to);
  return (
    <Sheet
      open={!!model}
      onClose={onClose}
      title={t('home.now.quick.title')}
      closeLabel={t('common.actions.close')}
      footer={
        <div className="flex flex-col gap-2">
          <RulesSheet open={rulesOpen} onClose={() => setRulesOpen(false)} />
          <p className="m-0 text-caption text-ink-muted">
            {t('home.now.quick.agree')}{' '}
            <button type="button" onClick={() => setRulesOpen(true)} className="text-accent-text underline underline-offset-2">
              {t('home.now.quick.rules')}
            </button>
          </p>
          <Button block size="lg" disabled={!quote.data} loading={create.isPending} onClick={() => create.mutate()}>
            {quote.data ? t('home.now.quick.pay', { amount: formatPrice(quote.data.payable, lang, display) }) : t('common.boot.loading')}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-2 pb-2">
        <p className="m-0 text-headline">{model?.name}</p>
        <p className="tabular m-0 text-body text-ink-muted">
          {formatDate(from, lang, timezone)} {formatTime(from, lang, timezone)} — {formatDate(to, lang, timezone)} {formatTime(to, lang, timezone)}
        </p>
        {!quote.data && !quote.isError && <Skeleton className="h-6 w-1/2" />}
        {quote.isError && <p role="alert" className="m-0 text-caption text-danger">{t(errorKey(errorCode(quote.error)))}</p>}
        {create.isError && <p role="alert" className="m-0 text-caption text-danger">{t(errorKey(errorCode(create.error)))}</p>}
      </div>
    </Sheet>
  );
}
