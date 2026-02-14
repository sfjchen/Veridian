# Veridian - EducAItion

Full EdTech platform: teacher side (classrooms, assignments, corpus, submissions) and student side (canvas, AI mistake analysis, Socratic chat). Shared Supabase.

## Repo Structure

| Path | Purpose |
|------|---------|
| `teacher/backend/` | Teacher backend (Flask) — classrooms, assignments, corpus |
| `teacher/frontend/` | Teacher frontend (Expo React) — dashboard, assignment creation |
| `student/backend/` | Student backend (Flask) — mistake analysis, OCR, chat |
| `student/frontend/` | Student frontend (Expo React) — canvas, document, workspace |
| `supabase/` | Shared DB migrations |
| `scripts/` | Migration script, etc. |
| `plans/` | Feature plans |

**Layout:** Symmetric `teacher/` and `student/` each with `backend/` and `frontend/`. Shared Supabase project.

## Prerequisites

Python 3.11+, Node 18+, Expo CLI. One Supabase project (migrations run once — see Supabase Migrations below).

## Quick run (from repo root)

After one-time setup, use the scripts in `scripts/`:

- **Teacher app:** `./scripts/setup-teacher.sh` once, then `./scripts/run-teacher.sh` (or run backend and frontend separately).
- **Student platform:** `./scripts/setup-student.sh` once, then `./scripts/run-student.sh`.

See `scripts/README.md` for all script options.

## Setup

1. Copy env: `teacher/backend/.env.example` → `teacher/backend/.env`, `teacher/frontend/.env.example` → `teacher/frontend/.env`, `student/backend/.env.example` → `student/backend/.env`, `student/frontend/.env.example` → `student/frontend/.env`
2. Install deps: `pip install -r requirements.txt` in `teacher/backend/` and `student/backend/`; `npm install` in `teacher/frontend/` and `student/frontend/`

(Migrations: run once per project via `./scripts/apply_migrations.sh` if needed.)

## Supabase Migrations

Run in this order (fresh DB):

1. Teacher: `supabase/all_migrations.sql`
2. Teacher: `supabase/migrations/20260214000008_*.sql`, `20260214000009_*.sql`
3. Student: `student/supabase/migrations/202602140001_*.sql`, `202602140003_*.sql`, `20260214153135_*.sql`, `20260214153124_*.sql`

**Script:** `./scripts/apply_migrations.sh` — set `SUPABASE_DB_URL`, requires `psql`. If teacher tables exist, run steps 2-3 only.

## Full Flows (Repeat Testing)

**Teacher flow:** Create classroom → upload corpus → create assignment → view submissions

```bash
# Terminal 1: Teacher backend (port 5001)
cd teacher/backend && python3 run.py

# Terminal 2: Teacher frontend
cd teacher/frontend && npx expo start
```

**Student flow:** Sample worksheet → canvas → Done → AI analysis → Socratic chat

```bash
# Terminal 1: Student backend (port 8000)
cd student/backend && python3 get_coords.py

# Terminal 2: Student frontend
cd student/frontend && npx expo start
```

**Both sides:** Run all four above. Backend required for full flows; frontend alone works for auth/login UI only.

## Quick Checks

| Test | Command |
|------|---------|
| Teacher backend | `cd teacher/backend && python3 run.py` — hit `/classrooms` with JWT |
| Student backend | `cd student/backend && python3 get_coords.py` — `curl http://localhost:8000/health` |

## Development

See `AGENTS.md`, `CLAUDE.md` for workflow and conventions. Running docs: `AGENTS.md`, `CLAUDE.md`, `README.md`, `PLAN.md`.
