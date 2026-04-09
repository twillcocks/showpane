#!/usr/bin/env bash
set -euo pipefail

# Showpane PostgreSQL restore script
# Usage: ./scripts/restore.sh <backup_file.sql.gz>

BACKUP_FILE="${1:-}"

if [ -z "$BACKUP_FILE" ]; then
  echo "Usage: ./scripts/restore.sh <backup_file.sql.gz>"
  exit 1
fi

if [ ! -f "$BACKUP_FILE" ]; then
  echo "Error: File not found: $BACKUP_FILE"
  exit 1
fi

echo "WARNING: This will overwrite all data in the Showpane database."
echo "Backup file: $BACKUP_FILE"
echo ""
read -p "Type 'yes' to continue: " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
  echo "Aborted."
  exit 0
fi

echo "Restoring Showpane database from $BACKUP_FILE..."
gunzip -c "$BACKUP_FILE" | docker compose exec -T db psql -U portal portal
echo "Restore complete."
