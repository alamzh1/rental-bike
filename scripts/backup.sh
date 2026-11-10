#!/bin/sh
# Раз в сутки делает pg_dump в /backups и удаляет копии старше BACKUP_RETENTION_DAYS дней.
set -eu
RETENTION="${BACKUP_RETENTION_DAYS:-30}"
while true; do
  STAMP="$(date -u +%Y%m%d-%H%M%S)"
  FILE="/backups/${PGDATABASE}-${STAMP}.sql.gz"
  if pg_dump --no-owner --format=plain | gzip > "${FILE}.tmp"; then
    mv "${FILE}.tmp" "${FILE}"
    echo "backup: ${FILE}"
  else
    rm -f "${FILE}.tmp"
    echo "backup: pg_dump failed" >&2
  fi
  find /backups -name "${PGDATABASE}-*.sql.gz" -mtime "+${RETENTION}" -delete
  sleep 86400
done
