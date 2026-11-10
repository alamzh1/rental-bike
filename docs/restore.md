# Бэкап и восстановление

## Что входит в резервную копию

| Данные | Где лежат | Как сохраняются |
|---|---|---|
| База PostgreSQL: брони, клиенты, платежи, парк, настройки, тексты, журнал | том `pgdata` контейнера `postgres` | сервис `backup` в `docker-compose.yml`: раз в сутки `pg_dump` в `backups/<POSTGRES_DB>-<дата>.sql.gz`, копии старше `BACKUP_RETENTION_DAYS` (по умолчанию 30) дней удаляются |
| Фото моделей, фотоакты, документы клиентов | `STORAGE_DIR` (по умолчанию `storage/`) или бакеты S3 `S3_BUCKET_PUBLIC` / `S3_BUCKET_PRIVATE` | **не входят** в `pg_dump` — копируйте отдельно (ниже) |
| Секреты `.env` | сервер | вручную, в надёжное место вне сервера |

Без `FILES_SIGNING_SECRET` документы и фотоакты из локального хранилища не расшифровать: он нужен вместе с копией папки. Документы клиентов хранятся не дольше `docRetentionDays` (настройка, по умолчанию 90 дней) — копии файлов храните не дольше этого срока.

## Бэкап

Ежедневный дамп включается вместе с инфраструктурой (`pnpm infra` или `docker compose up -d backup`). Проверить:

```bash
docker compose logs backup | tail      # строки «backup: /backups/rental-…sql.gz»
ls -lh backups/
```

Дамп вручную (например, перед обновлением):

```bash
docker compose exec -T postgres pg_dump -U "$POSTGRES_USER" --no-owner "$POSTGRES_DB" | gzip > "backups/manual-$(date -u +%Y%m%d-%H%M%S).sql.gz"
```

Файлы:

```bash
# локальное хранилище
tar -czf "backups/storage-$(date -u +%Y%m%d).tar.gz" -C "${STORAGE_DIR:-storage}" .
# S3 / MinIO — любым клиентом S3, например:
# mc mirror <alias>/<S3_BUCKET_PRIVATE> ./backups/s3-private
```

Папку `backups/` регулярно копируйте с сервера (другой сервер, облачное хранилище): копия на том же диске не спасает от его потери.

## Восстановление базы

1. Остановите API (чтобы никто не писал в базу): `systemctl stop rental-api` или остановите `pnpm dev`.
2. Пересоздайте пустую базу и залейте дамп:

```bash
docker compose up -d postgres
docker compose exec -T postgres dropdb -U "$POSTGRES_USER" --if-exists "$POSTGRES_DB"
docker compose exec -T postgres createdb -U "$POSTGRES_USER" "$POSTGRES_DB"
gunzip -c backups/<файл>.sql.gz | docker compose exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1
```

3. Догоните миграции, если код новее дампа: `pnpm --filter @rental/api db:deploy`.
4. Восстановите файлы: `tar -xzf backups/storage-<дата>.tar.gz -C "${STORAGE_DIR:-storage}"` (или зеркало бакетов обратно в S3).
5. Запустите API. Проверьте `GET /api/health`, вход в админку, «Сводку» и пару последних броней.

После восстановления на старую дату: брони, созданные позже дампа, пропадут, а оплаты по ним уже могли прийти. Сверьте раздел «Платежи» → «Сверка» с выпиской payOS и при необходимости внесите брони вручную («Брони» → «Новая бронь»).

Неоплаченные брони с истёкшим удержанием снимаются сами после старта API (фоновая задача находит просроченные удержания).

## Проверка бэкапа

Раз в месяц восстанавливайте последний дамп в отдельную базу и смотрите, что данные на месте:

```bash
docker compose exec -T postgres createdb -U "$POSTGRES_USER" restore_check
gunzip -c backups/<последний>.sql.gz | docker compose exec -T postgres psql -U "$POSTGRES_USER" -d restore_check -q
docker compose exec -T postgres psql -U "$POSTGRES_USER" -d restore_check -c "select count(*) from bookings"
docker compose exec -T postgres dropdb -U "$POSTGRES_USER" restore_check
```
