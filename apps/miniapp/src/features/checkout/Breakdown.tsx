import { useTranslation } from 'react-i18next';
import { PriceText } from '@rental/ui';
import { vndToRub, type Lang, type PaymentMethod, type Quote } from '@rental/shared';
import type { DisplayCurrency } from '@rental/ui';
import { formatRub } from '../payment/rub';

function Row({ label, children, strong }: { label: string; children: React.ReactNode; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1">
      <dt className={strong ? 'text-body-strong' : 'text-body text-ink-muted'}>{label}</dt>
      <dd className="m-0 text-right">{children}</dd>
    </div>
  );
}

/** Детализация суммы: аренда, опции, доставка; депозит отдельной строкой; итог «к оплате» зависит от способа. */
export function Breakdown({ quote, method, prepayPercent = 0, rubPerVnd = null, lang, display }: { quote: Quote; method: PaymentMethod; prepayPercent?: number; rubPerVnd?: number | null; lang: Lang; display?: DisplayCurrency }) {
  const { t } = useTranslation();
  const price = (vnd: number) => <PriceText vnd={vnd} lang={lang} display={display} size="body" />;
  return (
    <dl className="m-0 flex flex-col">
      <Row label={t('checkout.breakdown.rent', { days: quote.days })}>{price(quote.rent)}</Row>
      {quote.extras > 0 && <Row label={t('checkout.breakdown.extras')}>{price(quote.extras)}</Row>}
      {(quote.delivery ?? 0) > 0 && <Row label={t('checkout.breakdown.delivery')}>{price(quote.delivery ?? 0)}</Row>}
      <Row label={t('checkout.breakdown.total')} strong>
        {price(quote.total)}
      </Row>
      <div className="mt-2 border-t border-line pt-2">
        <Row label={t('checkout.breakdown.deposit')}>{price(quote.deposit)}</Row>
        <p className="m-0 pb-2 text-caption text-ink-muted">{t(method === 'RUB_TRANSFER' ? 'checkout.breakdown.depositCashNote' : 'checkout.breakdown.depositNote')}</p>
      </div>
      <div className="border-t border-line pt-3">
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-headline">{t(method !== 'CASH' || prepayPercent > 0 ? 'checkout.breakdown.payNow' : 'checkout.breakdown.payAtPickup')}</dt>
          <dd className="m-0 text-right">
            {method === 'RUB_TRANSFER' && rubPerVnd ? (
              <span className="tabular text-price-lg">{formatRub(vndToRub(quote.total, rubPerVnd), lang)}</span>
            ) : (
              <PriceText vnd={method === 'CASH' && prepayPercent > 0 ? Math.round((quote.total * prepayPercent) / 100) : quote.payable} lang={lang} display={display} size="price-lg" approxLayout="below" />
            )}
          </dd>
        </div>
      </div>
    </dl>
  );
}
