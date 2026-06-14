#!/usr/bin/env sh
set -eu

BACKEND_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)

if [ -f "$BACKEND_DIR/.env" ]; then
  set -a
  # shellcheck disable=SC1091
  . "$BACKEND_DIR/.env"
  set +a
fi

if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL wajib diisi dengan connection string PostgreSQL Supabase." >&2
  exit 1
fi

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
MIGRATION_DIR="$SCRIPT_DIR/../migrations"

case "$DATABASE_URL" in
  *".pooler.supabase.com"*) ;;
  *"db."*".supabase.co"*)
    echo "DATABASE_URL memakai Direct connection yang membutuhkan IPv6." >&2
    echo "Gunakan Session pooler URI dari Supabase Dashboard > Connect." >&2
    exit 1
    ;;
esac

for migration in "$MIGRATION_DIR"/*.sql; do
  echo "Menjalankan $(basename "$migration")"
  psql "$DATABASE_URL" \
    --set ON_ERROR_STOP=1 \
    --file "$migration"
done

echo "Semua migration berhasil dijalankan."
