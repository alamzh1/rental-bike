CREATE TYPE "ExpenseCategory" AS ENUM ('MAINTENANCE', 'REPAIR', 'PARTS', 'FUEL', 'INSURANCE', 'PURCHASE', 'SALARY', 'RENT', 'MARKETING', 'OTHER');

ALTER TABLE "bikes"
  ADD COLUMN "purchase_price" INTEGER,
  ADD COLUMN "tracker_device_id" TEXT,
  ADD COLUMN "tracker_token" TEXT,
  ADD COLUMN "last_lat" DOUBLE PRECISION,
  ADD COLUMN "last_lng" DOUBLE PRECISION,
  ADD COLUMN "last_speed_kmh" DOUBLE PRECISION,
  ADD COLUMN "last_battery_pct" INTEGER,
  ADD COLUMN "last_seen_at" TIMESTAMPTZ(3),
  ADD COLUMN "motion_alert_at" TIMESTAMPTZ(3);

CREATE UNIQUE INDEX "bikes_tracker_device_id_key" ON "bikes"("tracker_device_id");
CREATE UNIQUE INDEX "bikes_tracker_token_key" ON "bikes"("tracker_token");

CREATE TABLE "bike_positions" (
    "id" TEXT NOT NULL,
    "bike_id" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "speed_kmh" DOUBLE PRECISION,
    "recorded_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "bike_positions_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "bike_positions_bike_id_recorded_at_idx" ON "bike_positions"("bike_id", "recorded_at");
CREATE INDEX "bike_positions_recorded_at_idx" ON "bike_positions"("recorded_at");
ALTER TABLE "bike_positions" ADD CONSTRAINT "bike_positions_bike_id_fkey" FOREIGN KEY ("bike_id") REFERENCES "bikes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "expenses" (
    "id" TEXT NOT NULL,
    "location_id" TEXT,
    "bike_id" TEXT,
    "category" "ExpenseCategory" NOT NULL,
    "amount" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "comment" TEXT,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "expenses_date_idx" ON "expenses"("date");
CREATE INDEX "expenses_bike_id_date_idx" ON "expenses"("bike_id", "date");
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_bike_id_fkey" FOREIGN KEY ("bike_id") REFERENCES "bikes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
