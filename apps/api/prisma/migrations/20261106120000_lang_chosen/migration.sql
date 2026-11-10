-- Клиент выбрал язык сам: до этого приложение показывает экран выбора
ALTER TABLE "users" ADD COLUMN "lang_chosen_at" TIMESTAMPTZ(3);
