# Math Mistake Analysis Platform — Roadmap

**Running docs**: `AGENTS.md`, `CLAUDE.md`, `README.md`, `PLAN.md`.

## Overview

Full platform monorepo: teacher side (classrooms, assignments, corpus, submissions) and student side (canvas, AI mistake analysis, Socratic chat). Shared Supabase.

---

## Teacher Side (teacher/backend/, teacher/frontend/)

### Completed
- PR #1–9: Supabase schema, RLS, Flask backend, teacher/student dashboards, corpus/assignment/submission flows
- PR #10: Column name revert (`prompt_storage_path`)
- PR #11: Admin client, single-step corpus upload
- PR #12: PDF preview fallback, assignment hardening
- Supabase schema: profiles, classrooms, memberships, corpus_files, assignments, submissions
- RLS policies, JWT auth
- Teacher dashboard: create/list classrooms
- Student dashboard: join/list classrooms
- Corpus file upload, assignment creation, submission creation
- Signed URLs via admin client
- PDF-to-LaTeX conversion, PDF preview fallback

### Remaining
- **P0**: Student grading workflow, AI mistake analysis integration, E2E testing
- **P1**: Submission review screen with AI analysis, bulk operations
- **P2**: Due date warnings
- **P3**: Loading states, error boundaries, responsive design, pagination

---

## Student Side (student/backend/, student/frontend/)

### Completed
- Per-problem pipeline: OCR, mistake analysis, coordinate detection
- Red dot annotations, MistakeOverlay, progressive reveal
- problem_results table, WebSocket real-time push
- Socratic chat (Claude), ChatPanel UI
- Sample worksheet flow, workspace flow
- require_auth_or_sample for sample-only requests

### Remaining
- **Phase 3c**: Background analysis worker (ThreadPoolExecutor)
- **Phase 3d**: Result loading on app open
- **Phase 4**: Teacher backend integration (answer keys, context from corpus)
- **Phase 5c-d**: Chat guardrails, analytics
- **Phase 6**: Enhanced note-taking (grid/lined, colors, zoom)

---

## Tech Debt: Try-Catch Cleanup (student)

See `student/PLAN.md` for full inventory. Summary:

1. **Persistence retry** — Retry with backoff; dead-letter queue on failure
2. **WebSocket health** — `is_healthy()` check; polling fallback in frontend
3. **Status update** — Retry or derive from in-flight request
4. **Dot coords** — Pass dims from pipeline, avoid redundant PIL open
5. **Coord pipeline failure** — Return mistakes without coords, not empty list
6. **Stroke loading** — Schema version, validation, migration
7. **ViewShot capture** — Readiness check, surface capture errors
8. **Legacy submit** — Use isNetworkError, show actual error messages

---

## Architecture Decisions (Teacher)

| Decision | Rationale |
|----------|-----------|
| Shared Supabase | Single source of truth for assignments, results, chat |
| Admin client for DB | RLS + PostgREST joins caused silent failures |
| One problem per screen (student) | Clear UX, per-problem result history |
| 15s idle debounce | Balance responsiveness vs API cost |
| WebSocket for real-time | Push results without polling |
| threading for SocketIO | eventlet caused startup hangs |
| Signed URLs via admin client | User JWTs rejected by Storage API |
| PDF screenshot previews via backend | Consistent preview across clients |

---

## Open Decisions (User Input Needed)

1. **Supabase schema merge**: Teacher-side uses `assignments` with `prompt_storage_path`, `classrooms`, `corpus_files`, `submissions`. Student-platform uses `assignments` with `problems` jsonb, `problem_results`, `chat_messages`, artifact tables. Need to reconcile: single `assignments` table schema, or separate teacher/student tables with linking.

2. **Deployment**: Teacher and student backends are separate Flask apps (ports 5001 and 8000). Deploy as two services, or unify behind one gateway?

3. **Try-catch fixes priority**: The 8 items in student tech debt — fix before further feature work, or tackle incrementally?
