# Migration Guide — Setup, Run, Test

Full platform monorepo: teacher + student. One Supabase project for both. Migrations run once per project.

## What Lives Where

| Content | Location |
|---------|----------|
| Teacher Flask API | `teacher/backend/` |
| Teacher React app | `teacher/frontend/` |
| Student Flask API | `student/backend/` |
| Student Expo app | `student/frontend/` |
| Teacher migrations | `supabase/` |
| Student migrations | `student/supabase/migrations/` |
| Running docs | `AGENTS.md`, `CLAUDE.md`, `PLAN.md`, `README.md`, `MIGRATION_GUIDE.md` |
| Feature plans | `plans/` |
| Student roadmap | `student/PLAN.md` |

## Migration Order

Run in this order (fresh DB):

1. Teacher: `supabase/all_migrations.sql`
2. Teacher: `supabase/migrations/20260214000008_*.sql`, `20260214000009_*.sql`
3. Student: `student/supabase/migrations/202602140001_*.sql`, `202602140003_*.sql`, `20260214153135_*.sql`, `20260214153124_*.sql`

**Script:** `./scripts/apply_migrations.sh` — set `SUPABASE_DB_URL`, requires `psql`. If teacher tables exist, run steps 2–3 only.

## Run

```bash
# Teacher backend (port 5001)
cd teacher/backend && python3 run.py

# Student backend (port 8000)
cd student/backend && python3 get_coords.py

# Teacher frontend
cd teacher/frontend && npx expo start

# Student frontend
cd student/frontend && npx expo start
```

## What Works

| Side | Independent | Cohesive test |
|------|-------------|---------------|
| Teacher | Yes | Create classroom → corpus → assignment → submissions |
| Student (sample) | Yes | Sample worksheet → canvas → Done → AI analysis → chat |
| Both | Partial | Full flow blocked until schema merge (assignments.problems) |

**Env:** `teacher/backend/.env`, `teacher/frontend/.env`, `student/backend/.env`, `student/frontend/.env` — all use same Supabase URL/keys. Copy from `.env.example` files.
