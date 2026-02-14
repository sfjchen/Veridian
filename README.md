# Math Mistake Analysis Platform

EdTech platform for teachers to create math assignments and for students to submit solutions with AI-powered mistake analysis. Built with Flask + Expo React Native + Supabase.

## Repo Structure

| Directory | Purpose |
|-----------|---------|
| `backend/` | Teacher Flask API — classrooms, assignments, corpus, submissions |
| `frontend/` | Teacher React app — dashboard, assignment creation, submission review |
| `student-platform/` | Student Flask API + Expo app — canvas, mistake analysis, Socratic chat |
| `supabase/` | Shared database migrations |

## Prerequisites

- Python 3.11+
- Node.js 18+
- [Expo CLI](https://docs.expo.dev/get-started/installation/) (`npm install -g expo-cli`)
- [Supabase](https://supabase.com) project

## Quick Start

### Teacher Side

1. Copy `backend/.env.example` to `backend/.env` and `frontend/.env.example` to `frontend/.env`
2. Run migrations: `./scripts/apply_migrations.sh` (set `SUPABASE_DB_URL`) or apply in order (see `MIGRATION_GUIDE.md`)
3. Backend: `cd backend && pip install -r requirements.txt && python3 run.py`
4. Frontend: `cd frontend && npm install && npx expo start`

### Student Side

1. Copy `student-platform/.env.example` to `student-platform/.env`
2. Run migrations (see `MIGRATION_GUIDE.md` for full order; teacher migrations first)
3. Backend: `cd student-platform && pip install -r requirements.txt && python3 get_coords.py`
4. Frontend: `cd student-platform/frontend && npm install && npx expo start`

See `student-platform/README.md` for detailed student-platform setup.

## Architecture

**Teacher flow:** Create classrooms → upload corpus → create assignments → view submissions

**Student flow:** Join classroom → open assignment → work on canvas → tap Done → AI analyzes mistakes → Socratic chat per problem

**Shared:** One Supabase project for auth, assignments, problem_results, chat_messages, and all tables. Teacher and student apps use the same database. Student platform uses `get_coords.py` for OCR + mistake analysis + coordinate detection.

## Development

See `AGENTS.md` and `CLAUDE.md` for conventions, workflow, and code review process.

**Running docs**: `AGENTS.md`, `CLAUDE.md`, `README.md`, `PLAN.md`, `MIGRATION_GUIDE.md`. Update them in the same PR when features, architecture, or conventions change.
