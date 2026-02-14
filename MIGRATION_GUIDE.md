# Migration Guide — Setup, Run, Test

Monorepo: teacher dashboard + student platform. One Supabase project for both.

## What Lives Where

| Content | Location |
|---------|----------|
| Teacher Flask API | `backend/` |
| Teacher React app | `frontend/` |
| Student Flask API | `student-platform/get_coords.py` |
| Student Expo app | `student-platform/frontend/` |
| Teacher migrations | `supabase/` |
| Student migrations | `student-platform/supabase/migrations/` |
| Running docs | `AGENTS.md`, `CLAUDE.md`, `PLAN.md`, `README.md` |
| Feature plans | `plans/` |
| Student roadmap | `student-platform/PLAN.md` |

## Migration Order

Run in this order (fresh DB):

1. Teacher: `supabase/all_migrations.sql`
2. Teacher: `supabase/migrations/20260214000008_*.sql`, `20260214000009_*.sql`
3. Student: `202602140001_veridian_artifacts.sql`, `202602140003_veridian_sample_worksheets.sql`, `20260214153135_*.sql`, `20260214153124_*.sql`

**Script:** `./scripts/apply_migrations.sh` — set `SUPABASE_DB_URL`, requires `psql`. If teacher tables exist, run steps 2–3 only.

## Run

```bash
# Teacher backend (port 5001)
cd backend && python3 run.py

# Student backend (port 8000)
cd student-platform && python3 get_coords.py

# Teacher frontend
cd frontend && npx expo start

# Student frontend
cd student-platform/frontend && npx expo start
```

## What Works

| Side | Independent | Cohesive test |
|------|-------------|---------------|
| Teacher | Yes | Create classroom → corpus → assignment → submissions |
| Student (sample) | Yes | Sample worksheet → canvas → Done → AI analysis → chat |
| Both | Partial | Full flow blocked until schema merge (assignments.problems) |

**Env:** `backend/.env`, `frontend/.env`, `student-platform/.env` — all use same Supabase URL/keys. Copy from `.env.example` files.
