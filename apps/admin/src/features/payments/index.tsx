import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router-dom';
import { ReceiptText, Scale, Wallet } from 'lucide-react';
import type { AdminDeductionRow, AdminListOf, AdminPaymentList, AdminReconciliation, AdminReconciliationRow, AdminRubTransferRow, PaymentDto } from '@rental/shared';
import { Badge, Button, Chip, ChipGroup, EmptyState, Sheet, type BadgeTone } from '@rental/ui';
import { api } from '@/app/providers';
import { Alert, DataTable, Field, inputClass, PageHeader, td, th, useFormat, useMe } from '@/app/ui';
import { LoadGate, NumberInput, useAdminGet, useAdminSave } from '@/features/fleet/kit';

const TABS = ['reconciliation', 'transactions', 'deductions'] as const;
type Tab = (typeof TABS)[number];
const STATE_TONE: Record<AdminReconciliationRow['state'], BadgeTone> = { OK: 'neutral', UNDERPAID: 'danger', OVERPAID: 'warning', REFUND_DUE: 'warning' };
const PAYMENT_TONE: Record<PaymentDto['status'], BadgeTone> = { PAID: 'success', PENDING: 'warning', FAILED: 'danger', EXPIRED: 'neutral', CANCELLED: 'neutral' };
const KINDS = ['RENT', 'DEPOSIT', 'PREPAYMENT', 'SURCHARGE', 'REFUND'] as const;
const DAY = 86_400_000;

type RefundTarget = { row: AdminReconciliationRow; mode: 'new' | 'complete' };

/** Возврат: новый (на сумму) или отметка «выполнен» по ожидающему. Клиент получает сообщение бота с суммой. */
function RefundSheet({ target, onClose }: { target: RefundTarget; onClose: () => void }) {
  const { t } = useTranslation();
  const f = useFormat();
  const { row, mode } = target;
  const available = Math.max(0, row.received - row.refunded - row.refundPending);
  const [amount, setAmount] = useState<number | null>(mode === 'new' ? available : row.refundPending);
  const [comment, setComment] = useState('');
  const id = mode === 'new' ? row.paymentId! : row.pendingRefundId!;
  const save = useAdminSave((v: { amount?: number; comment?: string }) => api.post<PaymentDto>(`/admin/payments/${id}/refund`, v), {
    success: t('admin-fleet.payments.refundDone', { code: row.code }),
    invalidate: ['/admin/payments', '/admin/payments/reconciliation'],
  });
  const valid = mode === 'complete' || (!!amount && amount > 0 && amount <= available);
  return (
    <Sheet
      open
      onClose={onClose}
      title={mode === 'new' ? t('admin-fleet.payments.refundTitle', { code: row.code }) : t('admin-fleet.payments.completeTitle', { code: row.code })}
      closeLabel={t('admin.common.close')}
      footer={
        <Button block size="lg" disabled={!valid} loading={save.isLoading} onClick={() => save.mutate({ ...(mode === 'new' ? { amount: amount! } : {}), comment: comment.trim() || undefined }, { onSuccess: onClose })}>
          {mode === 'new' ? t('admin-fleet.payments.refundSubmit', { amount: f.money(amount ?? 0) }) : t('admin-fleet.payments.completeSubmit', { amount: f.money(row.refundPending) })}
        </Button>
      }
    >
      <div className="flex flex-col gap-4 pb-2">
        <p className="text-body text-ink-muted">{mode === 'new' ? t('admin-fleet.payments.refundText') : t('admin-fleet.payments.completeText')}</p>
        {save.error && <Alert>{save.error}</Alert>}
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-body">
          <dt className="text-ink-muted">{t('admin-fleet.payments.received')}</dt>
          <dd className="text-right tabular">{f.money(row.received)}</dd>
          <dt className="text-ink-muted">{t('admin-fleet.payments.refunded')}</dt>
          <dd className="text-right tabular">{f.money(row.refunded)}</dd>
          {row.refundPending > 0 && (
            <>
              <dt className="text-ink-muted">{t('admin-fleet.payments.refundPending')}</dt>
              <dd className="text-right tabular">{f.money(row.refundPending)}</dd>
            </>
          )}
        </dl>
        {mode === 'new' && (
          <Field label={t('admin-fleet.payments.amount')} htmlFor="refund-amount" hint={t('admin-fleet.payments.available', { amount: f.money(available) })}>
            <NumberInput id="refund-amount" value={amount} min={1} max={available} step={1000} suffix="₫" onChange={setAmount} invalid={!valid} />
          </Field>
        )}
        <Field label={t('admin-fleet.payments.comment')} htmlFor="refund-comment" hint={t('admin-fleet.payments.commentHint')}>
          <input id="refund-comment" value={comment} maxLength={500} onChange={(e) => setComment(e.target.value)} className={inputClass} />
        </Field>
      </div>
    </Sheet>
  );
}

function Reconciliation() {
  const { t } = useTranslation();
  const f = useFormat();
  const [onlyMismatches, setOnly] = useState(true);
  const [days, setDays] = useState(30);
  const [target, setTarget] = useState<RefundTarget | null>(null);
  const [anchor] = useState(() => Date.now());
  const q = useAdminGet<AdminReconciliation>('/admin/payments/reconciliation', {
    from: new Date(anchor - days * DAY).toISOString(),
    to: new Date(anchor + days * DAY).toISOString(),
    onlyMismatches: onlyMismatches ? '1' : undefined,
  });
  const rows = q.data?.items ?? [];

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <ChipGroup label={t('admin-fleet.payments.filter')} className="flex flex-wrap gap-2">
          <Chip selected={onlyMismatches} onClick={() => setOnly(true)}>
            {t('admin-fleet.payments.onlyMismatches', { count: q.data?.mismatches ?? 0 })}
          </Chip>
          <Chip selected={!onlyMismatches} onClick={() => setOnly(false)}>
            {t('admin-fleet.payments.allBookings')}
          </Chip>
        </ChipGroup>
        <label htmlFor="recon-days" className="ml-auto text-caption text-ink-muted">
          {t('admin-fleet.payments.window')}
        </label>
        <select id="recon-days" value={days} onChange={(e) => setDays(Number(e.target.value))} className={`${inputClass} w-auto`}>
          {[7, 30, 90, 180].map((d) => (
            <option key={d} value={d}>
              {t('admin-fleet.payments.windowDays', { days: d })}
            </option>
          ))}
        </select>
      </div>
      <LoadGate isLoading={q.isLoading} isError={q.isError} onRetry={() => void q.refetch()}>
        {rows.length === 0 ? (
          <EmptyState icon={Scale} title={onlyMismatches ? t('admin-fleet.payments.noMismatches') : t('admin-fleet.payments.noBookings')} text={onlyMismatches ? t('admin-fleet.payments.noMismatchesText') : undefined} className="py-12" />
        ) : (
          <div className="rounded-lg border border-line bg-surface-raised px-4">
            <DataTable
              label={t('admin-fleet.payments.tab.reconciliation')}
              head={
                <>
                  <th className={th}>{t('admin-fleet.payments.col.booking')}</th>
                  <th className={`${th} text-right`}>{t('admin-fleet.payments.col.expected')}</th>
                  <th className={`${th} text-right`}>{t('admin-fleet.payments.col.received')}</th>
                  <th className={`${th} text-right`}>{t('admin-fleet.payments.col.difference')}</th>
                  <th className={th}>{t('admin-fleet.payments.col.state')}</th>
                  <th className={th}>
                    <span className="sr-only">{t('admin-fleet.payments.col.actions')}</span>
                  </th>
                </>
              }
            >
              {rows.map((r) => (
                <tr key={r.bookingId} className={r.state === 'UNDERPAID' ? 'bg-danger-soft' : undefined}>
                  <td className={td}>
                    <Link to={`/bookings/${r.bookingId}`} className="text-body-strong text-accent-text underline-offset-4 tabular hover:underline">
                      {r.code}
                    </Link>
                    <span className="block text-caption text-ink-muted">
                      {r.clientName} · {f.date(r.startAt)} · {t(`admin.status.${r.status}`)}
                    </span>
                  </td>
                  <td className={`${td} whitespace-nowrap text-right tabular`}>{f.money(r.expected)}</td>
                  <td className={`${td} whitespace-nowrap text-right tabular`}>
                    {f.money(r.received)}
                    {(r.refunded > 0 || r.deducted > 0) && (
                      <span className="block text-caption text-ink-muted">
                        {[r.refunded > 0 && t('admin-fleet.payments.refundedShort', { amount: f.money(r.refunded) }), r.deducted > 0 && t('admin-fleet.payments.deductedShort', { amount: f.money(r.deducted) })].filter(Boolean).join(' · ')}
                      </span>
                    )}
                  </td>
                  <td className={`${td} whitespace-nowrap text-right tabular ${r.difference < 0 ? 'font-bold text-danger' : ''}`}>{r.difference === 0 ? '—' : `${r.difference > 0 ? '+' : '−'}${f.money(Math.abs(r.difference))}`}</td>
                  <td className={td}>
                    <Badge tone={STATE_TONE[r.state]}>{t(`admin-fleet.payments.state.${r.state}`)}</Badge>
                  </td>
                  <td className={`${td} whitespace-nowrap text-right`}>
                    {r.pendingRefundId ? (
                      <Button size="sm" variant="inverse" onClick={() => setTarget({ row: r, mode: 'complete' })}>
                        {t('admin-fleet.payments.complete')}
                      </Button>
                    ) : r.paymentId && r.received - r.refunded > 0 ? (
                      <Button size="sm" variant="secondary" onClick={() => setTarget({ row: r, mode: 'new' })}>
                        {t('admin-fleet.payments.refund')}
                      </Button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </DataTable>
          </div>
        )}
      </LoadGate>
      {target && <RefundSheet target={target} onClose={() => setTarget(null)} />}
    </>
  );
}

function Transactions() {
  const { t } = useTranslation();
  const f = useFormat();
  const [kind, setKind] = useState('');
  const [page, setPage] = useState(1);
  const q = useAdminGet<AdminPaymentList>('/admin/payments', { kind: kind || undefined, page });
  const rows = q.data?.items ?? [];
  const pages = Math.max(1, Math.ceil((q.data?.total ?? 0) / (q.data?.pageSize ?? 50)));
  return (
    <>
      <ChipGroup label={t('admin-fleet.payments.kind')} scroll className="mb-4 flex gap-2">
        <Chip selected={!kind} onClick={() => (setKind(''), setPage(1))}>
          {t('admin-fleet.texts.all')}
        </Chip>
        {KINDS.map((k) => (
          <Chip key={k} selected={kind === k} onClick={() => (setKind(k), setPage(1))}>
            {t(`admin-fleet.payments.kindName.${k}`)}
          </Chip>
        ))}
      </ChipGroup>
      <LoadGate isLoading={q.isLoading} isError={q.isError} onRetry={() => void q.refetch()}>
        {rows.length === 0 ? (
          <EmptyState icon={ReceiptText} title={t('admin-fleet.payments.noPayments')} className="py-12" />
        ) : (
          <div className="rounded-lg border border-line bg-surface-raised px-4">
            <DataTable
              label={t('admin-fleet.payments.tab.transactions')}
              head={
                <>
                  <th className={th}>{t('admin-fleet.payments.col.date')}</th>
                  <th className={th}>{t('admin-fleet.payments.col.booking')}</th>
                  <th className={th}>{t('admin-fleet.payments.kind')}</th>
                  <th className={`${th} text-right`}>{t('admin-fleet.payments.amount')}</th>
                  <th className={th}>{t('admin-fleet.payments.col.state')}</th>
                </>
              }
            >
              {rows.map((p) => (
                <tr key={p.id}>
                  <td className={`${td} whitespace-nowrap tabular`}>{f.dateTime(p.paidAt ?? p.createdAt)}</td>
                  <td className={td}>
                    <Link to={`/bookings/${p.bookingId}`} className="text-accent-text underline-offset-4 tabular hover:underline">
                      {p.bookingCode}
                    </Link>
                    <span className="block text-caption text-ink-muted">{p.clientName}</span>
                  </td>
                  <td className={td}>
                    {t(`admin-fleet.payments.kindName.${p.kind}`)}
                    <span className="block text-caption text-ink-muted">
                      {t(`admin.booking.method.${p.method}`)}
                      {p.comment ? ` · ${p.comment}` : ''}
                      {p.rubAmount ? ` · ${p.rubAmount.toLocaleString('ru-RU')} ₽` : ''}
                    </span>
                  </td>
                  <td className={`${td} whitespace-nowrap text-right tabular`}>
                    {p.kind === 'REFUND' ? '−' : ''}
                    {f.money(p.receivedAmount ?? p.amount)}
                    {p.receivedAmount !== null && p.receivedAmount !== p.amount && <span className="block text-caption text-danger">{t('admin-fleet.payments.expectedShort', { amount: f.money(p.amount) })}</span>}
                  </td>
                  <td className={td}>
                    <Badge tone={PAYMENT_TONE[p.status]}>{t(`admin-fleet.payments.status.${p.status}`)}</Badge>
                  </td>
                </tr>
              ))}
            </DataTable>
          </div>
        )}
      </LoadGate>
      {pages > 1 && (
        <nav className="mt-4 flex items-center justify-between gap-3" aria-label={t('admin.common.page', { page, pages })}>
          <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            {t('admin.common.prev')}
          </Button>
          <span className="text-caption text-ink-muted tabular">{t('admin.common.page', { page, pages })}</span>
          <Button variant="secondary" size="sm" disabled={page >= pages} onClick={() => setPage(page + 1)}>
            {t('admin.common.next')}
          </Button>
        </nav>
      )}
    </>
  );
}

function Deductions() {
  const { t } = useTranslation();
  const f = useFormat();
  const q = useAdminGet<AdminListOf<AdminDeductionRow>>('/admin/payments/deductions');
  const rows = q.data?.items ?? [];
  return (
    <LoadGate isLoading={q.isLoading} isError={q.isError} onRetry={() => void q.refetch()}>
      {rows.length === 0 ? (
        <EmptyState icon={Wallet} title={t('admin-fleet.payments.noDeductions')} text={t('admin-fleet.payments.noDeductionsText')} className="py-12" />
      ) : (
        <div className="rounded-lg border border-line bg-surface-raised px-4">
          <DataTable
            label={t('admin-fleet.payments.tab.deductions')}
            head={
              <>
                <th className={th}>{t('admin-fleet.payments.col.date')}</th>
                <th className={th}>{t('admin-fleet.payments.col.booking')}</th>
                <th className={th}>{t('admin-fleet.payments.reason')}</th>
                <th className={`${th} text-right`}>{t('admin-fleet.payments.amount')}</th>
              </>
            }
          >
            {rows.map((d) => (
              <tr key={d.id}>
                <td className={`${td} whitespace-nowrap tabular`}>{f.dateTime(d.createdAt)}</td>
                <td className={td}>
                  <Link to={`/bookings/${d.bookingId}`} className="text-accent-text underline-offset-4 tabular hover:underline">
                    {d.bookingCode}
                  </Link>
                  {d.createdBy && <span className="block text-caption text-ink-muted">{d.createdBy}</span>}
                </td>
                <td className={`${td} max-w-[420px]`}>{d.reason}</td>
                <td className={`${td} whitespace-nowrap text-right tabular`}>{f.money(d.amount)}</td>
              </tr>
            ))}
          </DataTable>
        </div>
      )}
    </LoadGate>
  );
}

/** Переводы в рублях, о которых сообщили клиенты: администратор сверяет с банком. Отменённая за это время бронь уйдёт в возврат. */
function RubTransfers() {
  const { t } = useTranslation();
  const f = useFormat();
  const q = useAdminGet<AdminListOf<AdminRubTransferRow>>('/admin/payments/rub-transfers');
  const refresh = { invalidate: ['/admin/payments/rub-transfers', '/admin/payments', '/admin/payments/reconciliation'] };
  const confirm = useAdminSave((id: string) => api.post(`/admin/payments/${id}/rub-confirm`), { success: t('admin-fleet.payments.rub.confirmed'), ...refresh });
  const reject = useAdminSave((id: string) => api.post(`/admin/payments/${id}/rub-reject`), { success: t('admin-fleet.payments.rub.rejected'), ...refresh });
  const rows = q.data?.items ?? [];
  if (rows.length === 0) return null;
  return (
    <section className="mb-6 rounded-lg border-2 border-accent bg-accent-soft p-4" aria-labelledby="rub-title">
      <h2 id="rub-title" className="text-title-2">{t('admin-fleet.payments.rub.title', { count: rows.length })}</h2>
      <p className="mb-3 text-body text-ink-muted">{t('admin-fleet.payments.rub.hint')}</p>
      {(confirm.error || reject.error) && <Alert>{confirm.error ?? reject.error}</Alert>}
      <ul className="flex flex-col gap-2">
        {rows.map((r) => (
          <li key={r.paymentId} className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-surface-raised p-3">
            <div className="min-w-0">
              <p className="text-price tabular">{r.rubAmount.toLocaleString('ru-RU')} ₽</p>
              <p className="text-caption text-ink-muted tabular">{f.money(r.amount)} · {f.dateTime(r.claimedAt)}</p>
              <p className="text-body">
                <Link to={`/bookings/${r.bookingId}`} className="text-accent-text underline-offset-4 tabular hover:underline">{r.bookingCode}</Link>
                {' · '}{r.clientName}{r.clientPhone ? ` · ${r.clientPhone}` : ''}
              </p>
              {r.bookingStatus !== 'PENDING_PAYMENT' && <p className="text-caption text-danger">{t('admin-fleet.payments.rub.cancelled')}</p>}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="inverse" loading={confirm.isLoading} onClick={() => confirm.mutate(r.paymentId)}>{t('admin-fleet.payments.rub.confirm')}</Button>
              <Button size="sm" variant="ghost" loading={reject.isLoading} onClick={() => reject.mutate(r.paymentId)}>{t('admin-fleet.payments.rub.reject')}</Button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Платежи: сверка ожидаемого и полученного (расхождения подсвечены), все транзакции, удержания из депозита, возвраты. */
export default function Payments() {
  const { t } = useTranslation();
  const canSeeRub = useMe().role === 'ADMIN';
  const [params, setParams] = useSearchParams();
  const tab: Tab = (TABS as readonly string[]).includes(params.get('tab') ?? '') ? (params.get('tab') as Tab) : 'reconciliation';
  return (
    <>
      <PageHeader title={t('admin.nav.payments')} meta={t('admin-fleet.payments.meta')} />
      {canSeeRub && <RubTransfers />}
      <ChipGroup label={t('admin-fleet.payments.tabs')} scroll className="mb-5 flex gap-2">
        {TABS.map((k) => (
          <Chip key={k} selected={tab === k} onClick={() => setParams(k === 'reconciliation' ? '' : `tab=${k}`, { replace: true })}>
            {t(`admin-fleet.payments.tab.${k}`)}
          </Chip>
        ))}
      </ChipGroup>
      {tab === 'reconciliation' && <Reconciliation />}
      {tab === 'transactions' && <Transactions />}
      {tab === 'deductions' && <Deductions />}
    </>
  );
}
