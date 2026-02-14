# Working from This Repo — Migration Guide

This monorepo consolidates the teacher dashboard and student learning platform. All development happens here.

## What Lives Where

| Content | Location | Notes |
|---------|----------|------|
| Teacher Flask API | `backend/` | Classrooms, assignments, corpus, submissions |
| Teacher React app | `frontend/` | Dashboard, assignment creation |
| Student Flask API | `student-platform/get_coords.py` | Mistake analysis, OCR, chat |
| Student Expo app | `student-platform/frontend/` | Canvas, document viewer, workspace |
| Student migrations | `student-platform/supabase/migrations/` | problem_results, chat_messages, etc. |
| Shared conventions | `AGENTS.md`, `CLAUDE.md` | Workflow, code style, review process |
| Merged roadmap | `PLAN.md` | Teacher + student phases, tech debt |
| Teacher roadmap | `docs/PLAN.md` | Teacher-specific detail |
| Student roadmap | `student-platform/PLAN.md` | Student phases, try-catch inventory |

## Standards (Applied Repo-Wide)

- **AGENTS.md**: Mandatory workflow, code style, PR review template (@codex @claude)
- **CLAUDE.md**: Project overview, key directories, conventions
- **Code style**: Type hints, ~20 line functions, max 3 params, no verbose logging

## Running Both Sides

```bash
# Terminal 1: Teacher backend
cd backend && python run.py

# Terminal 2: Student backend
cd student-platform && python get_coords.py

# Terminal 3: Teacher frontend
cd frontend && npx expo start

# Terminal 4: Student frontend
cd student-platform/frontend && npx expo start
```

## Key Files to Know

- `student-platform/README.md` — Student setup, API endpoints
- `student-platform/SUPABASE_INTEGRATION.md` — Supabase schema for student
- `student-platform/PLAN.md` — Student phases, tech debt (try-catch fixes)
- `docs/plans/` — Feature plans (create here for new work)
