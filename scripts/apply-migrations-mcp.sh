#!/usr/bin/env bash
# Apply migrations via psql OR document MCP path (no local Flask/Expo needed).
# For fresh DB: export SUPABASE_DB_URL then run apply_migrations.sh
# For Jchen04 Veridian project: migrations already applied 2026-06-05 — verify with:
#   supabase link --project-ref tpqasmpieyteutvdntda
#   supabase migration list
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Veridian Supabase project: tpqasmpieyteutvdntda"
echo ""
echo "Option A — already applied (recommended): use Cursor Supabase MCP"
echo "  list_migrations / list_tables project_id=tpqasmpieyteutvdntda"
echo ""
echo "Option B — fresh DB with psql:"
echo "  export SUPABASE_DB_URL='postgres://postgres:PASSWORD@db.tpqasmpieyteutvdntda.supabase.co:5432/postgres'"
echo "  $SCRIPT_DIR/apply_migrations.sh"
echo ""
echo "Option C — Supabase CLI (linked via supabase/config.toml):"
echo "  cd $(dirname "$SCRIPT_DIR") && supabase db push"

if command -v supabase >/dev/null 2>&1; then
  REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
  if [ -f "$REPO_ROOT/supabase/config.toml" ]; then
    echo ""
    echo "=== supabase migration list ==="
    (cd "$REPO_ROOT" && supabase migration list 2>/dev/null) || echo "(run: supabase link --project-ref tpqasmpieyteutvdntda)"
  fi
fi
