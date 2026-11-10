-- Клиент приехал, а забронированного байка нет на точке: случай, предложение замены, возврат денег
CREATE TYPE "IncidentStatus" AS ENUM ('OPEN', 'RESOLVED');
CREATE TYPE "IncidentResolution" AS ENUM ('SAME_MODEL', 'BIKE_PRESENT', 'REPLACED', 'CANCELLED');
CREATE TYPE "IncidentSource" AS ENUM ('CLIENT', 'STAFF', 'SYSTEM');
ALTER TYPE "CancelReason" ADD VALUE IF NOT EXISTS 'BIKE_MISSING';

CREATE TABLE "booking_incidents" (
  "id" TEXT NOT NULL,
  "booking_id" TEXT NOT NULL,
  "location_id" TEXT NOT NULL,
  "source" "IncidentSource" NOT NULL,
  "status" "IncidentStatus" NOT NULL DEFAULT 'OPEN',
  "resolution" "IncidentResolution",
  "comment" TEXT,
  "client_reported_at" TIMESTAMPTZ(3),
  "proposed_bike_id" TEXT,
  "proposed_rent" INTEGER,
  "proposed_at" TIMESTAMPTZ(3),
  "escalated_at" TIMESTAMPTZ(3),
  "resolved_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "booking_incidents_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "booking_incidents_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "booking_incidents_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "booking_incidents_proposed_bike_id_fkey" FOREIGN KEY ("proposed_bike_id") REFERENCES "bikes"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "booking_incidents_location_id_status_idx" ON "booking_incidents"("location_id", "status");
CREATE INDEX "booking_incidents_booking_id_idx" ON "booking_incidents"("booking_id");
-- На бронь один открытый случай: двойное нажатие не создаёт второй
CREATE UNIQUE INDEX "booking_incidents_one_open" ON "booking_incidents"("booking_id") WHERE "status" = 'OPEN';
