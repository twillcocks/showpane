#!/usr/bin/env bash
set -euo pipefail

# Showpane PostgreSQL backup script
# Usage: ./scripts/backup.sh [backup_dir]

BACKUP_DIR="${1:-./backups}"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
FILENAME="showpane-backup-${TIMESTAMP}.sql.gz"

mkdir -p "$BACKUP_DIR"

echo "Backing up Showpane database..."
docker compose exec -T db pg_dump --clean -U portal portal | gzip > "${BACKUP_DIR}/${FILENAME}"

echo "Backup saved to ${BACKUP_DIR}/${FILENAME}"
echo ""
echo "To restore:"
echo "  gunzip -c ${BACKUP_DIR}/${FILENAME} | docker compose exec -T db psql -U portal portal"
