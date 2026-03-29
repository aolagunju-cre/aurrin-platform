#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")/.." && pwd)"
MIGRATIONS_DIR="$ROOT_DIR/studio/src/lib/db/migrations"

SUPABASE_URL_VALUE="${NEXT_PUBLIC_SUPABASE_URL:-${SUPABASE_URL:-}}"
SUPABASE_ANON_KEY_VALUE="${NEXT_PUBLIC_SUPABASE_ANON_KEY:-${SUPABASE_ANON_KEY:-}}"
SUPABASE_SERVICE_ROLE_KEY_VALUE="${SUPABASE_SERVICE_ROLE_KEY:-${SUPABASE_SERVICE_KEY:-}}"
SUPABASE_JWT_SECRET_VALUE="${SUPABASE_JWT_SECRET:-}"

missing_keys=()

if [[ -z "$SUPABASE_URL_VALUE" ]]; then
  missing_keys+=("NEXT_PUBLIC_SUPABASE_URL (or legacy SUPABASE_URL)")
fi

if [[ -z "$SUPABASE_ANON_KEY_VALUE" ]]; then
  missing_keys+=("NEXT_PUBLIC_SUPABASE_ANON_KEY (or legacy SUPABASE_ANON_KEY)")
fi

if [[ -z "$SUPABASE_SERVICE_ROLE_KEY_VALUE" || "$SUPABASE_SERVICE_ROLE_KEY_VALUE" == "your-secret-key" ]]; then
  missing_keys+=("SUPABASE_SERVICE_ROLE_KEY (or legacy SUPABASE_SERVICE_KEY)")
fi

if [[ ${#missing_keys[@]} -gt 0 ]]; then
  {
    echo "ERROR: Missing required Supabase credentials for migration execution."
    echo "Set the following environment variables before running this script:"
    printf '  - %s\n' "${missing_keys[@]}"
    echo "Expected migration chain: $MIGRATIONS_DIR/*.sql"
  } >&2
  exit 1
fi

if [[ -z "$SUPABASE_JWT_SECRET_VALUE" || "$SUPABASE_JWT_SECRET_VALUE" == "your-secret-key" ]]; then
  echo "WARN: SUPABASE_JWT_SECRET is not configured; migrations will continue using Supabase token introspection." >&2
fi

export NEXT_PUBLIC_SUPABASE_URL="$SUPABASE_URL_VALUE"
export NEXT_PUBLIC_SUPABASE_ANON_KEY="$SUPABASE_ANON_KEY_VALUE"
export SUPABASE_SERVICE_ROLE_KEY="$SUPABASE_SERVICE_ROLE_KEY_VALUE"

if [[ ! -d "$MIGRATIONS_DIR" ]]; then
  echo "ERROR: Migration directory not found: $MIGRATIONS_DIR" >&2
  exit 1
fi

for required_file in 001_initial_schema.sql 002_rls_policies.sql; do
  if [[ ! -f "$MIGRATIONS_DIR/$required_file" ]]; then
    echo "ERROR: Missing required migration file: $MIGRATIONS_DIR/$required_file" >&2
    exit 1
  fi
done

if ! grep -Eq 'CREATE TABLE[[:space:]]+users' "$MIGRATIONS_DIR/001_initial_schema.sql"; then
  echo "ERROR: users table contract missing from 001_initial_schema.sql" >&2
  exit 1
fi

if ! grep -Eq 'CREATE TABLE[[:space:]]+role_assignments' "$MIGRATIONS_DIR/001_initial_schema.sql"; then
  echo "ERROR: role_assignments table contract missing from 001_initial_schema.sql" >&2
  exit 1
fi

if ! grep -Eq 'CREATE TABLE[[:space:]]+events' "$MIGRATIONS_DIR/001_initial_schema.sql"; then
  echo "ERROR: events table contract missing from 001_initial_schema.sql" >&2
  exit 1
fi

if ! grep -Eq 'CREATE TABLE[[:space:]]+founder_applications' "$MIGRATIONS_DIR/001_initial_schema.sql"; then
  echo "ERROR: founder_applications table contract missing from 001_initial_schema.sql" >&2
  exit 1
fi

if ! grep -Eq 'CREATE TABLE[[:space:]]+sponsors' "$MIGRATIONS_DIR/001_initial_schema.sql"; then
  echo "ERROR: sponsors table contract missing from 001_initial_schema.sql" >&2
  exit 1
fi

declare -a migration_chain=()
while IFS= read -r filename; do
  migration_chain+=("$filename")
done < <(
  find "$MIGRATIONS_DIR" -maxdepth 1 -type f -name '*.sql' ! -name 'rollback_*' -exec basename {} \; \
    | LC_ALL=C sort
)

if [[ ${#migration_chain[@]} -eq 0 ]]; then
  echo "ERROR: No migration files found in $MIGRATIONS_DIR" >&2
  exit 1
fi

echo "Deterministic migration chain (lexicographic):"
for migration_file in "${migration_chain[@]}"; do
  echo "  - $migration_file"
done

echo "Applying migrations from: $MIGRATIONS_DIR"
TEMP_SUPABASE_WORKDIR="$(mktemp -d "${TMPDIR:-/tmp}/aurrin-platform-supabase-XXXXXX")"
cleanup() {
  rm -rf "$TEMP_SUPABASE_WORKDIR"
}
trap cleanup EXIT

mkdir -p "$TEMP_SUPABASE_WORKDIR/supabase/migrations"

if [[ -d "$ROOT_DIR/studio/supabase" ]]; then
  cp -R "$ROOT_DIR/studio/supabase/." "$TEMP_SUPABASE_WORKDIR/supabase/"
fi

for migration_file in "${migration_chain[@]}"; do
  cp "$MIGRATIONS_DIR/$migration_file" "$TEMP_SUPABASE_WORKDIR/supabase/migrations/$migration_file"
done

(cd "$ROOT_DIR/studio" && npx supabase db push --linked --include-all --workdir "$TEMP_SUPABASE_WORKDIR" --yes)
