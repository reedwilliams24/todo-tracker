#!/usr/bin/env bash
# Applies supabase/migrations to a hosted project: `supabase db push` through the session pooler.
# The direct db.<ref>.supabase.co host is IPv6-only on the Free plan, so it goes through the pooler.
#
#   PROJECT_REF=… DB_PASSWORD=… POOLER_HOST=… scripts/supabase-db-push.sh [--dry-run]
set -euo pipefail

: "${PROJECT_REF:?PROJECT_REF is required}"
: "${DB_PASSWORD:?DB_PASSWORD is required}"
: "${POOLER_HOST:?POOLER_HOST is required}"

password=$(jq -rn --arg p "$DB_PASSWORD" '$p | @uri')
if [ -n "${GITHUB_ACTIONS:-}" ]; then echo "::add-mask::$password"; fi

pnpm exec supabase db push --yes "$@" \
  --db-url "postgresql://postgres.${PROJECT_REF}:${password}@${POOLER_HOST}:5432/postgres"
