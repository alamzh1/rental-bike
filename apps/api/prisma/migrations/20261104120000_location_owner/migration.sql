-- Владелец точки: своя точка, свои финансы и парк; реквизиты и ключи оплаты точки
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'OWNER';

ALTER TABLE "locations"
  ADD COLUMN "contact" TEXT,
  ADD COLUMN "legal_name" TEXT,
  ADD COLUMN "payos_client_id" TEXT,
  ADD COLUMN "payos_api_key" TEXT,
  ADD COLUMN "payos_checksum_key" TEXT,
  ADD COLUMN "payos_webhook_at" TIMESTAMPTZ(3);
