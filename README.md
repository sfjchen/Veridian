# Math Mistake Analysis Platform

Monorepo for the full EdTech platform: teacher side (classrooms, assignments, corpus, submissions) and student side (canvas, AI mistake analysis, Socratic chat). Shared Supabase.

## Repo Structure

| Path | Purpose |
|------|---------|
| `backend/` | Teacher backend (Flask) — classrooms, assignments, corpus |
| `frontend/` | Teacher frontend (Expo React) — dashboard, assignment creation |
| `student-platform/` | Student side — backend (`get_coords.py`) + frontend (`frontend/`) |
| `supabase/` | Shared DB migrations |
| `scripts/` | Migration script, etc. |
| `plans/` | Feature plans |

**Layout:** Teacher backend + frontend at root; student backend + frontend under `student-platform/`. Both use the same Supabase project.

## Prerequisites

Python 3.11+, Node 18+, Expo CLI. One Supabase project (migrations run once — see `MIGRATION_GUIDE.md`).

## One-Time Setup

1. Copy env: `backend/.env.example` → `backend/.env`, `frontend/.env.example` → `frontend/.env`, `student-platform/.env.example` → `student-platform/.env`
2. Install deps: `pip install -r requirements.txt` in `backend/` and `student-platform/`; `npm install` in `frontend/` and `student-platform/frontend/`

(Migrations: run once per project via `./scripts/apply_migrations.sh` if needed.)

## Full Flows (Repeat Testing)

**Teacher flow:** Create classroom → upload corpus → create assignment → view submissions

```bash
# Terminal 1: Teacher backend (port 5001)
cd backend && python3 run.py

# Terminal 2: Teacher frontend
cd frontend && npx expo start
```

**Student flow:** Sample worksheet → canvas → Done → AI analysis → Socratic chat

```bash
# Terminal 1: Student backend (port 8000)
cd student-platform && python3 get_coords.py

# Terminal 2: Student frontend
cd student-platform/frontend && npx expo start
```

**Both sides:** Run all four above. Backend required for full flows; frontend alone works for auth/login UI only.

## Quick Checks

| Test | Command |
|------|---------|
| Teacher backend | `cd backend && python3 run.py` — hit `/classrooms` with JWT |
| Student backend | `cd student-platform && python3 get_coords.py` — `curl http://localhost:8000/health` |

## Development

See `AGENTS.md`, `CLAUDE.md` for workflow and conventions. Running docs: `AGENTS.md`, `CLAUDE.md`, `README.md`, `PLAN.md`, `MIGRATION_GUIDE.md`.
