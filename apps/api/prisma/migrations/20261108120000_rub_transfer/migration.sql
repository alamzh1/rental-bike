-- Перевод в рублях: сумма и курс фиксируются в платеже, отметка клиента «я перевёл» ждёт подтверждения администратора.
ALTER TYPE "PaymentMethod" ADD VALUE 'RUB_TRANSFER';

ALTER TABLE "payments"
  ADD COLUMN "rub_amount" INTEGER,
  ADD COLUMN "rub_rate" DOUBLE PRECISION,
  ADD COLUMN "claimed_at" TIMESTAMPTZ(3);

CREATE INDEX "payments_claimed_at_idx" ON "payments"("claimed_at");
