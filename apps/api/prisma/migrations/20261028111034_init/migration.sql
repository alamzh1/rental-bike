-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "btree_gist";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('CLIENT', 'MANAGER', 'ADMIN');

-- CreateEnum
CREATE TYPE "Lang" AS ENUM ('ru', 'en', 'vi');

-- CreateEnum
CREATE TYPE "Currency" AS ENUM ('VND', 'RUB', 'USD');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('NONE', 'PENDING', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "LicenseCategory" AS ENUM ('A1', 'A', 'NONE');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('PASSPORT', 'LICENSE', 'IDP');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('UPLOADED', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ModelCategory" AS ENUM ('SCOOTER', 'MAXI_SCOOTER', 'SEMI_AUTO', 'MOTORCYCLE', 'ELECTRIC');

-- CreateEnum
CREATE TYPE "Transmission" AS ENUM ('AUTOMATIC', 'SEMI_AUTO', 'MANUAL', 'ELECTRIC');

-- CreateEnum
CREATE TYPE "BikeStatus" AS ENUM ('ACTIVE', 'REPAIR', 'RETIRED');

-- CreateEnum
CREATE TYPE "ExtraPer" AS ENUM ('DAY', 'ONCE');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('PENDING_PAYMENT', 'CONFIRMED', 'ISSUED', 'COMPLETED', 'CANCELLED_BY_CLIENT', 'CANCELLED_BY_SYSTEM', 'PROBLEM');

-- CreateEnum
CREATE TYPE "CancelReason" AS ENUM ('CLIENT', 'NOT_PAID', 'NO_SHOW', 'ADMIN');

-- CreateEnum
CREATE TYPE "DeliveryMethod" AS ENUM ('PICKUP', 'DELIVERY');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('VIETQR', 'CASH');

-- CreateEnum
CREATE TYPE "PaymentKind" AS ENUM ('RENT', 'DEPOSIT', 'PREPAYMENT', 'SURCHARGE', 'REFUND');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PAID', 'FAILED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "HandoverKind" AS ENUM ('ISSUE', 'RETURN');

-- CreateEnum
CREATE TYPE "PromoType" AS ENUM ('PERCENT', 'FIXED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "telegram_id" TEXT NOT NULL,
    "first_name" TEXT,
    "last_name" TEXT,
    "username" TEXT,
    "photo_url" TEXT,
    "phone" TEXT,
    "lang" "Lang" NOT NULL DEFAULT 'en',
    "currency" "Currency" NOT NULL DEFAULT 'USD',
    "role" "Role" NOT NULL DEFAULT 'CLIENT',
    "verification_status" "VerificationStatus" NOT NULL DEFAULT 'NONE',
    "license_category" "LicenseCategory",
    "last_payment_method" "PaymentMethod",
    "onboarded_at" TIMESTAMPTZ(3),
    "pd_consent_at" TIMESTAMPTZ(3),
    "license_warning_at" TIMESTAMPTZ(3),
    "location_id" TEXT,
    "is_demo" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" "DocumentType" NOT NULL,
    "file_key" TEXT NOT NULL,
    "content_type" TEXT,
    "license_category" "LicenseCategory",
    "expires_at" TIMESTAMPTZ(3),
    "status" "DocumentStatus" NOT NULL DEFAULT 'UPLOADED',
    "reject_reason" TEXT,
    "verified_by" TEXT,
    "verified_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(3),

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "locations" (
    "id" TEXT NOT NULL,
    "name" JSONB NOT NULL,
    "address" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "open_time" TEXT NOT NULL DEFAULT '08:00',
    "close_time" TEXT NOT NULL DEFAULT '20:00',
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
    "owner_id" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_demo" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brands" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "logo_key" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "brands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bike_models" (
    "id" TEXT NOT NULL,
    "location_id" TEXT NOT NULL,
    "brand_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "category" "ModelCategory" NOT NULL,
    "transmission" "Transmission" NOT NULL,
    "engine_cc" INTEGER,
    "year" INTEGER,
    "description" JSONB NOT NULL,
    "photos" JSONB NOT NULL DEFAULT '[]',
    "fuel_consumption" DOUBLE PRECISION,
    "tank_liters" DOUBLE PRECISION,
    "max_speed_kmh" INTEGER,
    "seats" INTEGER NOT NULL DEFAULT 2,
    "features" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "included" JSONB NOT NULL DEFAULT '[]',
    "conditions" JSONB,
    "license_required" "LicenseCategory" NOT NULL DEFAULT 'A1',
    "deposit" INTEGER NOT NULL,
    "rating" DOUBLE PRECISION,
    "reviews_count" INTEGER NOT NULL DEFAULT 0,
    "popularity" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_demo" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "bike_models_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bikes" (
    "id" TEXT NOT NULL,
    "model_id" TEXT NOT NULL,
    "location_id" TEXT NOT NULL,
    "plate" TEXT NOT NULL,
    "vin" TEXT,
    "mileage_km" INTEGER NOT NULL DEFAULT 0,
    "status" "BikeStatus" NOT NULL DEFAULT 'ACTIVE',
    "ready_at" TIMESTAMPTZ(3),
    "service_date" TIMESTAMPTZ(3),
    "insurance_until" TIMESTAMPTZ(3),
    "registration_doc_key" TEXT,
    "insurance_doc_key" TEXT,
    "is_demo" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "bikes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tariffs" (
    "id" TEXT NOT NULL,
    "model_id" TEXT NOT NULL,
    "min_days" INTEGER NOT NULL,
    "max_days" INTEGER,
    "price_per_day" INTEGER NOT NULL,
    "is_demo" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "tariffs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "season_rules" (
    "id" TEXT NOT NULL,
    "location_id" TEXT,
    "name" JSONB NOT NULL,
    "from" DATE NOT NULL,
    "to" DATE NOT NULL,
    "coefficient" DOUBLE PRECISION NOT NULL,
    "is_demo" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "season_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "extras" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" JSONB NOT NULL,
    "price" INTEGER NOT NULL,
    "per" "ExtraPer" NOT NULL,
    "max_qty" INTEGER NOT NULL DEFAULT 1,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_demo" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "extras_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promo_codes" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" "PromoType" NOT NULL,
    "value" INTEGER NOT NULL,
    "valid_from" TIMESTAMPTZ(3),
    "valid_to" TIMESTAMPTZ(3),
    "limit" INTEGER,
    "used" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "promo_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bookings" (
    "id" TEXT NOT NULL,
    "seq" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "model_id" TEXT NOT NULL,
    "bike_id" TEXT NOT NULL,
    "location_id" TEXT NOT NULL,
    "start_at" TIMESTAMPTZ(3) NOT NULL,
    "end_at" TIMESTAMPTZ(3) NOT NULL,
    "buffer_minutes" INTEGER NOT NULL DEFAULT 60,
    "blocked_until" TIMESTAMPTZ(3),
    "actual_start_at" TIMESTAMPTZ(3),
    "actual_end_at" TIMESTAMPTZ(3),
    "status" "BookingStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
    "cancel_reason" "CancelReason",
    "cancelled_at" TIMESTAMPTZ(3),
    "hold_expires_at" TIMESTAMPTZ(3),
    "payment_method" "PaymentMethod" NOT NULL,
    "delivery_method" "DeliveryMethod" NOT NULL DEFAULT 'PICKUP',
    "delivery_address" TEXT,
    "delivery_lat" DOUBLE PRECISION,
    "delivery_lng" DOUBLE PRECISION,
    "phone" TEXT,
    "lang" "Lang" NOT NULL,
    "agreed_at" TIMESTAMPTZ(3),
    "promo_code_id" TEXT,
    "rent_amount" INTEGER NOT NULL,
    "extras_amount" INTEGER NOT NULL DEFAULT 0,
    "delivery_amount" INTEGER NOT NULL DEFAULT 0,
    "discount_amount" INTEGER NOT NULL DEFAULT 0,
    "deposit_amount" INTEGER NOT NULL DEFAULT 0,
    "total_amount" INTEGER NOT NULL,
    "late_fee_amount" INTEGER NOT NULL DEFAULT 0,
    "refund_amount" INTEGER,
    "quote" JSONB NOT NULL,
    "source" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_extras" (
    "id" TEXT NOT NULL,
    "booking_id" TEXT NOT NULL,
    "extra_id" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "unit_price" INTEGER NOT NULL,
    "per" "ExtraPer" NOT NULL,
    "amount" INTEGER NOT NULL,

    CONSTRAINT "booking_extras_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_status_changes" (
    "id" TEXT NOT NULL,
    "booking_id" TEXT NOT NULL,
    "from" "BookingStatus",
    "to" "BookingStatus" NOT NULL,
    "actor_id" TEXT,
    "reason" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "booking_status_changes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "booking_id" TEXT NOT NULL,
    "kind" "PaymentKind" NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "provider" TEXT,
    "amount" INTEGER NOT NULL,
    "received_amount" INTEGER,
    "currency" "Currency" NOT NULL DEFAULT 'VND',
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "external_id" TEXT,
    "qr_payload" TEXT,
    "expires_at" TIMESTAMPTZ(3),
    "paid_at" TIMESTAMPTZ(3),
    "raw" JSONB,
    "comment" TEXT,
    "created_by" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "handover_acts" (
    "id" TEXT NOT NULL,
    "booking_id" TEXT NOT NULL,
    "bike_id" TEXT NOT NULL,
    "kind" "HandoverKind" NOT NULL,
    "mileage_km" INTEGER NOT NULL,
    "fuel_level" INTEGER NOT NULL,
    "photos" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "damages" TEXT,
    "manager_id" TEXT NOT NULL,
    "client_confirmed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "handover_acts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deposit_deductions" (
    "id" TEXT NOT NULL,
    "booking_id" TEXT NOT NULL,
    "act_id" TEXT,
    "amount" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "photos" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deposit_deductions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reviews" (
    "id" TEXT NOT NULL,
    "booking_id" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "text" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "favorites" (
    "user_id" TEXT NOT NULL,
    "model_id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "favorites_pkey" PRIMARY KEY ("user_id","model_id")
);

-- CreateTable
CREATE TABLE "banners" (
    "id" TEXT NOT NULL,
    "title" JSONB NOT NULL,
    "text" JSONB,
    "image_key" TEXT,
    "link" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_demo" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "banners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settings" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "is_demo" BOOLEAN NOT NULL DEFAULT false,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "i18n_overrides" (
    "id" TEXT NOT NULL,
    "lang" "Lang" NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "i18n_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "actor_id" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entity_id" TEXT,
    "diff" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analytics_events" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "name" TEXT NOT NULL,
    "props" JSONB,
    "source" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analytics_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_telegram_id_key" ON "users"("telegram_id");

-- CreateIndex
CREATE INDEX "documents_user_id_idx" ON "documents"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "brands_name_key" ON "brands"("name");

-- CreateIndex
CREATE UNIQUE INDEX "bike_models_slug_key" ON "bike_models"("slug");

-- CreateIndex
CREATE INDEX "bike_models_location_id_is_active_idx" ON "bike_models"("location_id", "is_active");

-- CreateIndex
CREATE INDEX "bike_models_category_idx" ON "bike_models"("category");

-- CreateIndex
CREATE UNIQUE INDEX "bikes_plate_key" ON "bikes"("plate");

-- CreateIndex
CREATE UNIQUE INDEX "bikes_vin_key" ON "bikes"("vin");

-- CreateIndex
CREATE INDEX "bikes_model_id_status_idx" ON "bikes"("model_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "tariffs_model_id_min_days_key" ON "tariffs"("model_id", "min_days");

-- CreateIndex
CREATE INDEX "season_rules_from_to_idx" ON "season_rules"("from", "to");

-- CreateIndex
CREATE UNIQUE INDEX "extras_code_key" ON "extras"("code");

-- CreateIndex
CREATE UNIQUE INDEX "promo_codes_code_key" ON "promo_codes"("code");

-- CreateIndex
CREATE UNIQUE INDEX "bookings_seq_key" ON "bookings"("seq");

-- CreateIndex
CREATE UNIQUE INDEX "bookings_code_key" ON "bookings"("code");

-- CreateIndex
CREATE INDEX "bookings_user_id_status_idx" ON "bookings"("user_id", "status");

-- CreateIndex
CREATE INDEX "bookings_model_id_status_start_at_idx" ON "bookings"("model_id", "status", "start_at");

-- CreateIndex
CREATE INDEX "bookings_bike_id_start_at_idx" ON "bookings"("bike_id", "start_at");

-- CreateIndex
CREATE INDEX "bookings_status_hold_expires_at_idx" ON "bookings"("status", "hold_expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "booking_extras_booking_id_extra_id_key" ON "booking_extras"("booking_id", "extra_id");

-- CreateIndex
CREATE INDEX "booking_status_changes_booking_id_created_at_idx" ON "booking_status_changes"("booking_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "payments_external_id_key" ON "payments"("external_id");

-- CreateIndex
CREATE INDEX "payments_booking_id_idx" ON "payments"("booking_id");

-- CreateIndex
CREATE INDEX "payments_status_created_at_idx" ON "payments"("status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "handover_acts_booking_id_kind_key" ON "handover_acts"("booking_id", "kind");

-- CreateIndex
CREATE INDEX "deposit_deductions_booking_id_idx" ON "deposit_deductions"("booking_id");

-- CreateIndex
CREATE UNIQUE INDEX "reviews_booking_id_key" ON "reviews"("booking_id");

-- CreateIndex
CREATE UNIQUE INDEX "i18n_overrides_lang_key_key" ON "i18n_overrides"("lang", "key");

-- CreateIndex
CREATE INDEX "audit_logs_entity_entity_id_idx" ON "audit_logs"("entity", "entity_id");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

-- CreateIndex
CREATE INDEX "analytics_events_name_created_at_idx" ON "analytics_events"("name", "created_at");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_verified_by_fkey" FOREIGN KEY ("verified_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "locations" ADD CONSTRAINT "locations_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bike_models" ADD CONSTRAINT "bike_models_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bike_models" ADD CONSTRAINT "bike_models_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "brands"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bikes" ADD CONSTRAINT "bikes_model_id_fkey" FOREIGN KEY ("model_id") REFERENCES "bike_models"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bikes" ADD CONSTRAINT "bikes_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tariffs" ADD CONSTRAINT "tariffs_model_id_fkey" FOREIGN KEY ("model_id") REFERENCES "bike_models"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "season_rules" ADD CONSTRAINT "season_rules_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_model_id_fkey" FOREIGN KEY ("model_id") REFERENCES "bike_models"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_bike_id_fkey" FOREIGN KEY ("bike_id") REFERENCES "bikes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_promo_code_id_fkey" FOREIGN KEY ("promo_code_id") REFERENCES "promo_codes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_extras" ADD CONSTRAINT "booking_extras_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_extras" ADD CONSTRAINT "booking_extras_extra_id_fkey" FOREIGN KEY ("extra_id") REFERENCES "extras"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_status_changes" ADD CONSTRAINT "booking_status_changes_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_status_changes" ADD CONSTRAINT "booking_status_changes_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "handover_acts" ADD CONSTRAINT "handover_acts_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "handover_acts" ADD CONSTRAINT "handover_acts_bike_id_fkey" FOREIGN KEY ("bike_id") REFERENCES "bikes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "handover_acts" ADD CONSTRAINT "handover_acts_manager_id_fkey" FOREIGN KEY ("manager_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deposit_deductions" ADD CONSTRAINT "deposit_deductions_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deposit_deductions" ADD CONSTRAINT "deposit_deductions_act_id_fkey" FOREIGN KEY ("act_id") REFERENCES "handover_acts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deposit_deductions" ADD CONSTRAINT "deposit_deductions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_model_id_fkey" FOREIGN KEY ("model_id") REFERENCES "bike_models"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================================
-- Защита от двойной брони (ТЗ §5.3, история 35)
-- ============================================================

-- Номера броней BK-XXXXX начинаются с 10001
ALTER SEQUENCE "bookings_seq_seq" RESTART WITH 10001;

-- blocked_until = end_at + буфер на осмотр и мойку (по умолчанию 60 мин). Считается в БД,
-- чтобы приложение не могло вставить интервал без буфера.
CREATE FUNCTION bookings_set_blocked_until() RETURNS trigger AS $$
BEGIN
  NEW.blocked_until := NEW.end_at + make_interval(mins => NEW.buffer_minutes);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER bookings_blocked_until
  BEFORE INSERT OR UPDATE OF end_at, buffer_minutes ON "bookings"
  FOR EACH ROW EXECUTE FUNCTION bookings_set_blocked_until();

ALTER TABLE "bookings" ADD CONSTRAINT "bookings_period_valid" CHECK ("end_at" > "start_at" AND "buffer_minutes" >= 0);

-- Интервалы [start_at, end_at + буфер) одного байка не пересекаются среди броней, держащих байк.
-- Конфликт → SQLSTATE 23P01 (exclusion_violation), API отвечает 409 BIKE_TAKEN.
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_bike_no_overlap"
  EXCLUDE USING gist (
    "bike_id" WITH =,
    tstzrange("start_at", "blocked_until", '[)') WITH &&
  )
  WHERE ("status" IN ('PENDING_PAYMENT', 'CONFIRMED', 'ISSUED', 'PROBLEM'));
