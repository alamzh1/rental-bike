import { parsePhone } from '../checkout/phone';

export interface QuickPayState {
  phone: string | null;
  documentsReady: boolean;
  needsLicense: boolean;
  delivery: boolean;
}

/**
 * История 70: клиент с сохранёнными телефоном и документами идёт с «Нужен байк сейчас» сразу к оплате после согласия.
 * Если нужны права, которых нет, или доставка — полное оформление.
 */
export function quickPayEligible(s: QuickPayState): boolean {
  return !!s.phone && parsePhone(s.phone).ok && s.documentsReady && !s.needsLicense && !s.delivery;
}
