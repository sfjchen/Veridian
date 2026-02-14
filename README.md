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

1. Copy `.env.example` to `backend/.env` and `frontend/.env`
2. Run migrations in `supabase/all_migrations.sql` (or individual files)
3. Backend: `cd backend && pip install -r requirements.txt && python run.py`
4. Frontend: `cd frontend && npm install && npx expo start`

### Student Side

1. Copy `student-platform/.env.example` to `student-platform/.env`
2. Apply `student-platform/supabase/migrations/*.sql` to your Supabase project
3. Backend: `cd student-platform && pip install -r requirements.txt && python get_coords.py`
4. Frontend: `cd student-platform/frontend && npm install && npx expo start`

See `student-platform/README.md` for detailed student-platform setup.

## Architecture

**Teacher flow:** Create classrooms → upload corpus → create assignments → view submissions

**Student flow:** Join classroom → open assignment → work on canvas → tap Done → AI analyzes mistakes → Socratic chat per problem

**Shared:** Supabase (auth, assignments, problem_results, chat_messages). Student platform uses `get_coords.py` for OCR + mistake analysis + coordinate detection.

## Development

See `AGENTS.md` and `CLAUDE.md` for conventions, workflow, and code review process.

**Running docs**: `AGENTS.md`, `CLAUDE.md`, `README.md`, and `PLAN.md` are the project's living documentation. Update them in the same PR when features, architecture, or conventions change.
