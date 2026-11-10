// Черновик оформления в памяти вкладки: переход к документам или правилам не сбрасывает форму.
import type { PaymentMethod } from '@rental/shared';

export interface CheckoutDraft {
  delivery: boolean;
  address: string;
  pin: { lat: number; lng: number } | null;
  extras: Record<string, number>;
  phoneInput: string | null;
  methodChoice: PaymentMethod | null;
  agreed: boolean;
}

const key = (modelId: string) => `checkout-draft:${modelId}`;

export function readDraft(modelId: string): CheckoutDraft | null {
  try {
    const raw = sessionStorage.getItem(key(modelId));
    return raw ? (JSON.parse(raw) as CheckoutDraft) : null;
  } catch {
    return null;
  }
}

export function writeDraft(modelId: string, draft: CheckoutDraft): void {
  try {
    sessionStorage.setItem(key(modelId), JSON.stringify(draft));
  } catch {
    // без хранилища форма просто не переживёт переход
  }
}

export function clearDraft(modelId: string): void {
  try {
    sessionStorage.removeItem(key(modelId));
  } catch {
    // нечего очищать
  }
}
