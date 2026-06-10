#!/usr/bin/env bash
# Backup diário do banco pg-miozorio (M0.3). Roda na VPS às 04:00
# (cron do host OU "Scheduled Task" do Dokploy). Retenção: 14 dias.
# NÃO contém segredos — lê tudo de variáveis de ambiente.
set -euo pipefail

CONTAINER="${PG_CONTAINER:-pg-miozorio}"
DB_NAME="${POSTGRES_DB:-miozorio}"
DB_USER="${POSTGRES_USER:-miozorio}"
BACKUP_DIR="${BACKUP_DIR:-/opt/backups/pg-miozorio}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
STAMP="$(date +%Y%m%d-%H%M%S)"
OUT="${BACKUP_DIR}/miozorio-${STAMP}.sql.gz"

mkdir -p "$BACKUP_DIR"
echo "[$(date)] pg_dump de ${DB_NAME} (container ${CONTAINER})..."
docker exec "$CONTAINER" pg_dump -U "$DB_USER" -d "$DB_NAME" | gzip >"$OUT"
echo "[$(date)] salvo: ${OUT} ($(du -h "$OUT" | cut -f1))"

# Rotação: remove backups com mais de RETENTION_DAYS dias.
find "$BACKUP_DIR" -name 'miozorio-*.sql.gz' -mtime +"$RETENTION_DAYS" -delete
echo "[$(date)] retenção ${RETENTION_DAYS}d aplicada. Backups atuais:"
ls -1t "$BACKUP_DIR"/miozorio-*.sql.gz 2>/dev/null | head -20

# Crontab sugerido na VPS (04:00 todo dia):
#   0 4 * * * POSTGRES_USER=miozorio POSTGRES_DB=miozorio /opt/scripts/backup-pg-miozorio.sh >> /var/log/backup-miozorio.log 2>&1
