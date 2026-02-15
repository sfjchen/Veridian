#!/usr/bin/env bash
# Apply all Supabase migrations in correct order.
# For fresh DBs only — teacher migrations use "create table" (no if not exists).
# Requires: SUPABASE_DB_URL (postgres://postgres:PASSWORD@db.PROJECT_REF.supabase.co:5432/postgres)
# Get from: Supabase Dashboard → Project Settings → Database → Connection string (URI)
# Requires: psql (PostgreSQL client)
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

if [ -z "${SUPABASE_DB_URL}" ]; then
  echo "Set SUPABASE_DB_URL (postgres://postgres:PASSWORD@db.PROJECT_REF.supabase.co:5432/postgres)" >&2
  echo "Get it from Supabase Dashboard → Project Settings → Database → Connection string (URI)" >&2
  exit 1
fi

run_sql() {
  psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f "$1"
}

echo "=== 1. Teacher migrations (001-007) ==="
run_sql "$REPO_ROOT/supabase/all_migrations.sql"

echo "=== 2. Teacher migration 008 (unique submission) ==="
run_sql "$REPO_ROOT/supabase/migrations/20260214000008_add_unique_submission_per_student_assignment.sql"

echo "=== 3. Teacher migration 009 (problem_results, chat_messages) ==="
run_sql "$REPO_ROOT/supabase/migrations/20260214000009_problem_results_chat_messages.sql"

echo "=== 4. Migration 010 (config columns on classrooms + assignments) ==="
run_sql "$REPO_ROOT/supabase/migrations/20260214000010_add_config_columns.sql"

echo "=== 5. Migration 011 (live monitoring indexes) ==="
run_sql "$REPO_ROOT/supabase/migrations/20260214000011_add_live_monitoring_indexes.sql"

echo "=== 6. Migration 20260215000001 (problems column) ==="
run_sql "$REPO_ROOT/supabase/migrations/20260215000001_add_problems_column.sql"

echo "=== 7. Migration 20260215000002 (nullable corpus storage_path) ==="
run_sql "$REPO_ROOT/supabase/migrations/20260215000002_make_corpus_storage_path_nullable.sql"

echo "=== 8. Migration 20260215000003 (conversion columns) ==="
run_sql "$REPO_ROOT/supabase/migrations/20260215000003_add_conversion_columns.sql"

echo "=== 9. Student: veridian_artifacts ==="
run_sql "$REPO_ROOT/student/supabase/migrations/202602140001_veridian_artifacts.sql"

echo "=== 10. Student: veridian_sample_worksheets ==="
run_sql "$REPO_ROOT/student/supabase/migrations/202602140003_veridian_sample_worksheets.sql"

echo "=== 11. Student: fix function search_path ==="
run_sql "$REPO_ROOT/student/supabase/migrations/20260214153135_fix_function_search_path.sql"

echo "=== 12. Student: chat_messages index (if not in 009) ==="
run_sql "$REPO_ROOT/student/supabase/migrations/20260214153124_add_chat_messages_assignment_id_index.sql"

echo "Done. All migrations applied."
