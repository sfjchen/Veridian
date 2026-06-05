# Supabase — Jchen04 Veridian project

## Project

| Field | Value |
|-------|-------|
| Org | Jchen04's Org (`isgzoxesevazrrgqxqtl`) |
| Name | Veridian |
| Ref | `tpqasmpieyteutvdntda` |
| URL | `https://tpqasmpieyteutvdntda.supabase.co` |
| Region | us-west-2 |

**Not** the hackathon project `daxwryjtzesdfjldvwsi` — all four app `.env` files should use this ref.

## Cursor Supabase MCP

The Cursor Supabase plugin MCP works against this project:

- `list_projects` → Veridian (`tpqasmpieyteutvdntda`)
- `apply_migration` / `execute_sql` / `list_tables` / `get_advisors` / `generate_typescript_types`

Project ID for MCP calls: `tpqasmpieyteutvdntda`

## CLI link

```bash
cd /path/to/Veridian
supabase link --project-ref tpqasmpieyteutvdntda
```

`supabase/config.toml` is checked in with `project_id = "tpqasmpieyteutvdntda"`.

## Migrations applied (2026-06-05)

Applied via MCP in order matching `scripts/apply_migrations.sh` plus:

- `20260215000004_make_submissions_storage_path_nullable.sql`
- `20260216000001_add_solutions_column.sql`

**14** migration records in `supabase_migrations.schema_migrations`.

**Do not apply** `student/supabase/migrations/202602140002_assignments_problems.sql` on this schema — it defines a conflicting `assignments` table (`teacher_id` model). The teacher/classroom schema is canonical.

### Re-apply on a fresh DB

```bash
export SUPABASE_DB_URL='postgres://postgres:PASSWORD@db.tpqasmpieyteutvdntda.supabase.co:5432/postgres'
./scripts/apply_migrations.sh
```

Or use Supabase MCP `apply_migration` per SQL file.

## Env files (local)

Copy from `.env.example`, then set:

| Var | Where |
|-----|-------|
| `SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_URL` | `https://tpqasmpieyteutvdntda.supabase.co` |
| `SUPABASE_ANON_KEY` / `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Dashboard → API → anon (or `supabase projects api-keys`) |
| `SUPABASE_SERVICE_ROLE_KEY` | Dashboard → API → service_role (backends only) |
| `SUPABASE_JWT_SECRET` | Dashboard → API → JWT Settings → **paste into both backends** |

## Sample worksheet seed

Whiteboard demo expects slug `high-school-algebra-01` in `veridian_sample_worksheets` (see `get_coords.py`). Seeded via MCP on setup.

## Verification

```bash
# Tables
# MCP: list_tables project_id=tpqasmpieyteutvdntda schemas=["public"]

# Student backend
cd student/backend && python3 get_coords.py
curl http://localhost:8000/health   # {"status":"ok"}

# Service role read
python3 -c "from pathlib import Path; from dotenv import load_dotenv; import os; from supabase import create_client; load_dotenv(Path('student/backend/.env')); sb=create_client(os.environ['SUPABASE_URL'], os.environ['SUPABASE_SERVICE_ROLE_KEY']); print(sb.table('profiles').select('id', count='exact').limit(0).execute())"
```

## Security advisors (expected WARN)

Upstream migrations expose `SECURITY DEFINER` RPCs (`get_user_role`, `get_student_classroom_ids`, `handle_new_user`) to anon/authenticated — same as [VeridianTH/Veridian](https://github.com/VeridianTH/Veridian). Harden in a follow-up if exposing REST directly.

## Fork remotes

- `origin` → `VeridianTH/Veridian`
- `fork` → `sfjchen/Veridian`

## Deployment (whiteboard slice)

- **Frontend:** https://veridian-student.vercel.app (Vercel project `veridian-student`)
- **Backend:** Render via root `render.yaml` — see `plans/whiteboard-deployment.md`
- **Auth redirects:** add `https://veridian-student.vercel.app/**` in Supabase Auth URL config
