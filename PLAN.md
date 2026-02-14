# Math Mistake Analysis Platform — Roadmap

**Running docs**: `AGENTS.md`, `CLAUDE.md`, `README.md`, `PLAN.md`.

## Overview

Full platform monorepo: teacher side (classrooms, assignments, corpus, submissions) and student side (canvas, AI mistake analysis, Socratic chat). Shared Supabase.

---

## Teacher Side (teacher/backend/, teacher/frontend/)

### Completed

- PR #1-9: Supabase schema, RLS, Flask backend, teacher/student dashboards, corpus/assignment/submission flows
- PR #10: Column name revert (`prompt_storage_path`)
- PR #11: Admin client, single-step corpus upload
- PR #12: PDF preview fallback, assignment hardening
- PR #21: Live monitoring + insights
- PR #22: Classroom and assignment CRUD
- PR #23: Corpus management
- PR #24: Documentation consistency fixes
- Supabase schema: profiles, classrooms, memberships, corpus_files, assignments, submissions
- RLS policies, JWT auth
- Teacher dashboard: create/list classrooms, assignments, corpus
- Student dashboard: join/list classrooms
- Signed URLs via admin client
- PDF-to-LaTeX conversion, PDF preview fallback

### Remaining

- **P0**: Teacher config system (classroom defaults + per-assignment overrides) — PR #3 in notebook overhaul
- **P1**: Submission review screen with AI analysis, bulk operations
- **P2**: Due date warnings, loading states, error boundaries

---

## Student Side (student/backend/, student/frontend/)

### Completed

- Per-problem pipeline: OCR, mistake analysis, coordinate detection
- Red dot annotations, MistakeOverlay, progressive reveal
- problem_results table, WebSocket real-time push
- Socratic chat (Claude), ChatPanel UI
- Results persistence with retry + dead-letter queue
- Sample worksheet flow, workspace flow
- require_auth_or_sample for sample-only requests

### Student Notebook Overhaul (current focus)

6 parallel PRs to transform the student app from prototype to assignment-driven, teacher-controlled experience:

| PR | Title | Status | Dependencies |
|----|-------|--------|-------------|
| 1 | Fix Anthropic `thinking` SDK parameter | Not started | Standalone |
| 2 | Student home screen (classrooms > assignments) | Not started | Standalone (uses PR 7 tokens if available) |
| 3 | Teacher config system (classroom defaults + overrides) | Not started | Standalone |
| 4 | Student app reads teacher config | Not started | Depends on PR 3 |
| 5 | Eliminate all silent failures | Not started | Standalone |
| 7 | Shared design system + visual overhaul | Not started | Standalone |

See `student/PLAN.md` for detailed specs on each PR.

### Future Milestones

- **Chat intelligent context**: Teacher selects corpus files per assignment; chat uses them as tutoring context
- **Enhanced note-taking**: Grid/lined backgrounds, color palette, stroke width, pinch-to-zoom
- **Analytics**: Daily aggregation — struggle heatmap, engagement metrics, AI-synthesized concept gaps

---

## Tech Debt: Silent Failure Cleanup (student)

See `student/PLAN.md` for full inventory. Summary:

| # | Item | Status |
|---|------|--------|
| 1 | Persistence retry | FIXED |
| 2 | WebSocket health | Still present |
| 3 | Status update | FIXED |
| 4 | Dot coords | Partially fixed |
| 5 | Coord pipeline failure | Still present |
| 6 | Stroke loading | Partially fixed |
| 7 | ViewShot capture | Improved |
| 8 | Legacy submit | Improved |

---

## Architecture Decisions

| Decision | Rationale |
|----------|-----------|
| Shared Supabase | Single source of truth for assignments, results, chat |
| Admin client for DB | RLS + PostgREST joins caused silent failures |
| Assignment-driven student flow | Teacher uploads everything, students just solve |
| Invisible analysis | No spinners; teacher config controls triggers and visibility |
| One problem per screen (student) | Clear UX, per-problem result history |
| Configurable analysis trigger | Default 15s idle debounce; teacher can set auto/manual/passive |
| WebSocket for real-time | Push results without polling |
| threading for SocketIO | eventlet caused startup hangs |
| Signed URLs via admin client | User JWTs rejected by Storage API |
| PDF screenshot previews via backend | Consistent preview across clients |
| Teacher config resolution | Classroom defaults + assignment overrides, merged at fetch time |
