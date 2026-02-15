# Veridian - EducAItion

Full EdTech platform: teacher side (classrooms, assignments, corpus, submissions) and student side (canvas, AI mistake analysis, Socratic chat). Shared Supabase.

## Student Runtime Config (PR #4)

- Student assignment behavior is now controlled by teacher `resolved_config` values returned by student backend `GET /assignments/:id`.
- Endpoint contract is auth-protected and membership-gated (`401` unauthenticated, `403` non-member).
- Student app honors:
  - `analysis_trigger`: `auto_idle`, `auto_page_change`, `manual_only`, `passive`
  - `check_button_visible`, `chat_enabled`
  - `dot_threshold`, `max_dots_shown`
  - `notification_style`: `silent`, `toast`, `badge`

## Repo Structure

| Path | Purpose |
|------|---------|
| `teacher/backend/` | Teacher backend (Flask) — classrooms, assignments, corpus |
| `teacher/frontend/` | Teacher frontend (Expo React) — dashboard, assignment creation; Veridian design system (tokens + `src/components/ui/`) |
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

1. **Copy env** (4 apps, 4 `.env` files — each app loads from its own dir):
   - `teacher/backend/.env.example` → `teacher/backend/.env` (set `CORS_ALLOWED_ORIGINS` for your frontend hosts)
   - `teacher/frontend/.env.example` → `teacher/frontend/.env` (set `EXPO_PUBLIC_API_URL=http://localhost:5001` for teacher backend)
   - `student/backend/.env.example` → `student/backend/.env`
   - `student/frontend/.env.example` → `student/frontend/.env` (set `EXPO_PUBLIC_BACKEND_URL` for student backend, e.g. `http://localhost:8000`)
2. **Install deps**: `pip install -r requirements.txt` in `teacher/backend/` and `student/backend/`; `npm install` in `teacher/frontend/` and `student/frontend/`

(Migrations: run once per project via `./scripts/apply_migrations.sh` if needed.)

**Convention**: When adding packages or env vars, update `requirements.txt` (or `package.json`), the relevant `.env.example`, and running docs in the same PR.

## Supabase Migrations

Run in this order (fresh DB):

1. Teacher: `supabase/all_migrations.sql`
2. Teacher: `supabase/migrations/20260214000008_*.sql`, `20260214000009_*.sql`, `20260215000001_*.sql`
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

## Demo flow

Use this sequence for a repeatable demo:

1. **Teacher:** Sign in to the teacher app.
2. **Teacher:** Create a classroom (note or copy the class code).
3. **Teacher:** Create an assignment (add title; optionally due date and assignment file).
4. **Teacher:** (Optional) Upload a corpus file for the classroom.
5. **Student:** Sign in to the student app.
6. **Student:** Join the class using the class code.
7. **Student:** Open the assignment and submit a solution.
8. **Teacher:** (Optional) View submissions for the assignment.

## Conversion Progress WebSocket

- Namespace: `/conversion` on teacher backend.
- Auth required: send teacher JWT token in Socket.IO `auth.token`.
- Subscribe payload: `{ "job_id": "<uuid>" }`.
- For PDF/TEX conversion endpoints, frontend can send `job_id` in multipart form to subscribe before conversion starts.

## Quick Checks

| Test | Command |
|------|---------|
| Teacher backend | `cd teacher/backend && python3 run.py` — hit `/classrooms` with JWT |
| Student backend | `cd student/backend && python3 get_coords.py` — `curl http://localhost:8000/health` |

After migrations: assignments load without config errors; corpus upload works.

## Production Deployment

Frontends deploy to Vercel; backends (Flask + Socket.IO) deploy to Railway or Render. See `plans/production-deployment.md` for env vars, DNS, and deployment steps. Domain: veridian.fyi (teacher.veridian.fyi, student.veridian.fyi).

## Development

See `AGENTS.md`, `CLAUDE.md` for workflow and conventions. Running docs: `AGENTS.md`, `CLAUDE.md`, `README.md`, `PLAN.md`.
