# Run scripts

Run from **repo root** (e.g. `./scripts/run-teacher-backend.sh`).

## Teacher app (Math Mistake Analysis)

| Script | Purpose |
|--------|--------|
| `setup-teacher.sh` | One-time: create backend venv, install deps, copy `.env.example` → `backend/.env` |
| `run-teacher-backend.sh` | Start Flask backend on http://localhost:5001 |
| `run-teacher-frontend.sh` | Start Expo frontend (run backend first or in another terminal) |
| `run-teacher.sh` | Start backend in background, then frontend (one terminal) |

## Student platform (Veridian)

| Script | Purpose |
|--------|--------|
| `setup-student.sh` | One-time: create venv in `student/backend/`, install deps, set up `.env` files |
| `run-student-backend.sh` | Start Flask backend on http://localhost:8000 |
| `run-student-frontend.sh` | Start Expo frontend (run backend first or in another terminal) |
| `run-student.sh` | Start backend in background, then frontend (one terminal) |

## First time

1. **Teacher:** `./scripts/setup-teacher.sh` then fill in `teacher/backend/.env` and `teacher/frontend/.env` (see root README).
2. **Student:** `./scripts/setup-student.sh` then fill in `student/backend/.env` and `student/frontend/.env` (see student/backend/README.md).

Then run the app with `run-teacher.sh` or `run-student.sh`, or run backend and frontend in two terminals.
