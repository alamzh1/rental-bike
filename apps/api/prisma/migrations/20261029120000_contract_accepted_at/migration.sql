-- Подтверждение договора аренды клиентом в приложении (ТЗ §11.1)
ALTER TABLE "bookings" ADD COLUMN "contract_accepted_at" TIMESTAMPTZ(3);
