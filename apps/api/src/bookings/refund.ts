import { refundPercent, type RefundRules } from '@rental/shared';

// Сумма возврата при отмене: аренда (+ опции, доставка) — по проценту из правил отмены (shared.refundPercent),
// внесённый депозит и излишек возвращаются полностью. paid — уже за вычетом сделанных возвратов (refundedTotal).
export function refundFor(
  b: { startAt: Date; totalAmount: number; depositAmount: number },
  paid: number,
  at: Date,
  rules: RefundRules,
): { percent: number; amount: number } {
  const percent = refundPercent(b.startAt, at, rules);
  const net = Math.max(0, paid);
  const depositPaid = Math.min(b.depositAmount, Math.max(0, net - b.totalAmount));
  // Излишек сверх аренды и депозита — не плата за аренду: возвращается полностью
  const excess = Math.max(0, net - b.totalAmount - b.depositAmount);
  const rentPaid = net - depositPaid - excess;
  return { percent, amount: Math.floor((rentPaid * percent) / 100) + depositPaid + excess };
}

const INCOMING = new Set(['RENT', 'DEPOSIT', 'PREPAYMENT', 'SURCHARGE']);

/** Сколько клиент фактически заплатил онлайн и менеджеру (без возвратов). */
export function paidTotal(payments: { kind: string; status: string; amount: number; receivedAmount: number | null }[]): number {
  return payments.filter((p) => INCOMING.has(p.kind) && p.status === 'PAID').reduce((s, p) => s + (p.receivedAmount ?? p.amount), 0);
}

/** Уже возвращено или записано к возврату: повторно эти деньги не возвращаются. */
export function refundedTotal(payments: { kind: string; status: string; amount: number }[]): number {
  return payments.filter((p) => p.kind === 'REFUND' && (p.status === 'PAID' || p.status === 'PENDING')).reduce((s, p) => s + p.amount, 0);
}
