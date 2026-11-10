-- Клиент сообщил снова после ответа точки «байк на месте»: решает администратор, сама отмена не открывается
ALTER TABLE "booking_incidents" ADD COLUMN "disputed" BOOLEAN NOT NULL DEFAULT false;
