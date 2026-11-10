import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EXPENSE_CATEGORIES, type AdminBike, type AdminExpense, type AdminExpenseInput, type ExpenseCategory } from '@rental/shared';
import { Button, Sheet } from '@rental/ui';
import { api } from '@/app/providers';
import { Alert, Field, inputClass } from '@/app/ui';
import { NumberInput, textareaClass, useAdminSave } from '@/features/fleet/kit';

const INVALIDATE = ['/admin/finance/summary', '/admin/finance/expenses', '/admin/tracking'];

export function ExpenseSheet({ expense, bikes, today, presetBikeId, onClose }: { expense: AdminExpense | null; bikes: AdminBike[]; today: string; presetBikeId?: string | null; onClose: () => void }) {
  const { t } = useTranslation();
  const [date, setDate] = useState(expense?.date ?? today);
  const [category, setCategory] = useState<ExpenseCategory>(expense?.category ?? 'MAINTENANCE');
  const [amount, setAmount] = useState<number | null>(expense?.amount ?? null);
  const [bikeId, setBikeId] = useState(expense?.bikeId ?? presetBikeId ?? '');
  const [comment, setComment] = useState(expense?.comment ?? '');
  const [confirming, setConfirming] = useState(false);
  const save = useAdminSave((body: AdminExpenseInput) => (expense ? api.patch<AdminExpense>(`/admin/finance/expenses/${expense.id}`, body) : api.post<AdminExpense>('/admin/finance/expenses', body)), {
    success: t('admin-ops.expense.saved'),
    invalidate: INVALIDATE,
  });
  const remove = useAdminSave((id: string) => api.del<void>(`/admin/finance/expenses/${id}`), { success: t('admin-ops.expense.deleted'), invalidate: INVALIDATE });
  const valid = !!date && !!amount && amount > 0;

  return (
    <Sheet
      open
      onClose={onClose}
      title={expense ? t('admin-ops.expense.edit') : t('admin-ops.expense.add')}
      closeLabel={t('admin.common.close')}
      className="sm:max-w-[560px]"
      footer={
        <Button block size="lg" loading={save.isLoading} disabled={!valid} onClick={() => save.mutate({ date, category, amount: amount ?? 0, bikeId: bikeId || null, comment: comment.trim() || null }, { onSuccess: onClose })}>
          {t('admin-fleet.common.save')}
        </Button>
      }
    >
      <div className="flex flex-col gap-4 pb-2">
        {(save.error ?? remove.error) && <Alert>{save.error ?? remove.error}</Alert>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('admin-ops.expense.amount')} htmlFor="e-amount">
            <NumberInput id="e-amount" value={amount} min={1} suffix="₫" onChange={setAmount} />
          </Field>
          <Field label={t('admin-ops.expense.date')} htmlFor="e-date">
            <input id="e-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className={`${inputClass} tabular`} />
          </Field>
          <Field label={t('admin-ops.expense.category')} htmlFor="e-category">
            <select id="e-category" value={category} onChange={(e) => setCategory(e.target.value as ExpenseCategory)} className={inputClass}>
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {t(`admin-ops.category.${c}`)}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t('admin-ops.expense.bike')} htmlFor="e-bike" hint={t('admin-ops.expense.bikeHint')}>
            <select id="e-bike" value={bikeId} onChange={(e) => setBikeId(e.target.value)} className={inputClass}>
              <option value="">{t('admin-ops.expense.noBike')}</option>
              {bikes.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.plate} · {b.modelName}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label={t('admin-ops.expense.comment')} htmlFor="e-comment">
          <textarea id="e-comment" rows={2} maxLength={500} value={comment} onChange={(e) => setComment(e.target.value)} className={textareaClass} />
        </Field>
        {expense &&
          (confirming ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-body">{t('admin-ops.expense.deleteConfirm')}</span>
              <Button size="sm" variant="secondary" className="text-danger" loading={remove.isLoading} onClick={() => remove.mutate(expense.id, { onSuccess: onClose })}>
                {t('admin-ops.expense.delete')}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>
                {t('admin.common.cancel')}
              </Button>
            </div>
          ) : (
            <Button size="sm" variant="ghost" className="self-start text-danger" onClick={() => setConfirming(true)}>
              {t('admin-ops.expense.delete')}
            </Button>
          ))}
      </div>
    </Sheet>
  );
}
