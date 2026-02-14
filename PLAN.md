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

- **P0**: Teacher config system (classroom defaults + per-assignment overrides)
- **P1**: Submission review screen with AI analysis, bulk operations
- **P2**: Due date warnings, loading states, error boundaries

---

## Student Side (student/backend/, student/frontend/)

### Completed

- Per-problem pipeline: OCR, mistake analysis, coordinate detection
- Red dot annotations, MistakeOverlay, progressive reveal
- problem_results table, WebSocket real-time push, result persistence with retry + DLQ
- Socratic chat (Claude), ChatPanel UI
- Sample worksheet flow, workspace flow
- require_auth_or_sample for sample-only requests
- Teacher CRUD: Classrooms, assignments, corpus files (PRs #21-23)
- PR 2: Student home screen — ClassroomsScreen, AssignmentsScreen, GET /classrooms, GET /classrooms/:id/assignments; assignment-only document entry; back label context-aware
- No silent failures: stroke load/save and docs load/save/remove errors surfaced in UI (document screen error bar); backend continuation-artifact and coord-pipeline failures logged

### Backend services

- `get_coords.py` — Main Flask server (refactored: ~20 line functions, max 3 params)
- `assignment_service.py` — Assignment + problem fetching from Supabase
- `classroom_service.py` — List classrooms for student, list assignments for classroom (membership check)
- `result_service.py` — Per-problem result persistence with retry + DLQ
- `chat.py` — Socratic tutoring with Claude (claude-sonnet-4-5 + extended thinking)
- `chat_service.py` — Chat history persistence
- `websocket_service.py` — Real-time WebSocket push via flask-socketio
- `auth_middleware.py` — JWT authentication middleware

### Frontend (student/frontend/)

- `app/(tabs)/index.tsx` — ClassroomsScreen (card grid of joined classrooms)
- `app/assignments/[classroomId].tsx` — AssignmentsScreen (per-classroom assignment list)
- `app/document/[id].tsx` — Per-problem canvas with auto-analysis; assignment-only entry when opened from assignment
- `components/MistakeOverlay.tsx` — Red dots with progressive reveal
- `components/ChatPanel.tsx` — Socratic chat bottom sheet
- `components/ProblemHeader.tsx` — KaTeX rendering via WebView
- `hooks/useAutoAnalysis.ts` — 15s idle debounce with error callbacks
- `hooks/useAssignment.ts` — Assignment data fetching
- `hooks/useClassrooms.ts` — Classrooms list (GET /classrooms)
- `hooks/useAssignments.ts` — Assignments list per classroom (GET /classrooms/:id/assignments)
- `hooks/useChat.ts` — Chat with optimistic updates
- `hooks/useWebSocket.ts` — Real-time result push
- `lib/api.ts` — API client with typed endpoints

---

## Student Notebook Overhaul (current focus)

6 parallel PRs to transform the student app from prototype to assignment-driven, teacher-controlled experience. Core shift: **assignment-driven flow** (teacher uploads everything, students just solve) with **invisible analysis** (no spinners, no manual triggers unless teacher configures it) and **teacher-controlled behavior** (config system controls every aspect of what students see).

| PR | Title | Priority | Status | Dependencies |
|----|-------|----------|--------|--------------|
| 4 | Student app reads teacher config | P0 | Not started | Depends on PR 3 |

### Completed (Confirmed)

- PR 1: Fix Anthropic `thinking` SDK parameter
- PR 2: Student home screen (classrooms > assignments)
- PR 3: Teacher config system (classroom defaults + overrides)
- PR 5: Eliminate all silent failures
- PR 7: Shared design system + visual overhaul

### PR 1: Fix Anthropic `thinking` SDK Parameter

**P0 — Done**

The `thinking` parameter format in `client.py` and `chat.py` causes `Messages.create() got an unexpected keyword argument 'thinking'` errors. Fix the parameter format to match what `anthropic>=0.79.0` expects.

**Files**: `student/backend/mistake_analysis/client.py` (line 112), `student/backend/chat.py` (lines 81-84)

### PR 2: Student Home Screen — Classrooms > Assignments

**P0 — Done**

Replace the "Library" / "Add PDF" flow with an assignment-driven home screen. Students see their classrooms, tap to see assignments, tap an assignment to open the canvas. No student-initiated PDF uploads.

**Key changes**:
- Replace `LibraryScreen` with `ClassroomsScreen` (card grid)
- New `AssignmentsScreen` for per-classroom assignment list
- Strip out PDF upload UI and legacy document management
- Wire assignment tap to existing `DocumentScreen` in problem mode

### PR 3: Teacher Config System (Classroom Defaults + Assignment Overrides)

**P0 — Done**

Add teacher-controlled config that governs student behavior: check button visibility, dot threshold, analysis trigger mode, notification style, chat enabled/disabled. Classroom-level defaults with per-assignment overrides.

**Config fields**: `check_button_visible`, `dot_threshold`, `max_dots_shown`, `analysis_trigger` (auto_idle/auto_page_change/manual_only/passive), `notification_style` (silent/toast/badge), `chat_enabled`

**Student backend**: `assignment_service.py` gets `get_resolved_config()` — merges classroom defaults with assignment overrides.

### PR 4: Student App Reads Teacher Config (depends on PR 3)

**P0**

Make the student frontend respect all teacher config fields. Remove the "Analyzing..." spinner, conditionally render Check button, gate chat on `chat_enabled`, apply `dot_threshold` and `max_dots_shown` in `MistakeOverlay`, apply `analysis_trigger` mode in `useAutoAnalysis`.

### PR 5: Eliminate All Silent Failures

**P1 — Done**

Surfaced all remaining silent failure patterns: document screen stroke load/save and WebView parse errors show in a dismissible error bar; useDocuments load/save/remove/add errors exposed and shown where used; backend logs errors for continuation-artifact storage, coord pipeline, and coord-run creation (no more bare `except: pass`).

### PR 7: Shared Design System + Visual Overhaul

**P2 — Done**

Create `packages/design/` with Veridian branding (green-primary #16A34A), shared components (Card, Button, Toast, Skeleton, EmptyState, ErrorState), and apply across both frontends. Notability-like minimal canvas UX. Card grid navigation.

---

## Tech Debt: Silent Failure Inventory

| # | Item | Status | Action |
|---|------|--------|--------|
| 1 | Fire-and-forget persistence | FIXED (retry + DLQ) | No action |
| 2 | WebSocket emit | STILL PRESENT | Add `is_healthy()` check; no-op when uninitialized |
| 3 | Status update on analysis | FIXED (retry) | No action |
| 4 | Dot coordinate computation | PARTIALLY FIXED | Cache `image_dims` from pipeline, pass through |
| 5 | Mistake coord pipeline | IMPROVED | Failures logged; mistakes fallback to [] |
| 6 | Stroke loading | FIXED | Error surfaced in banner; document list load/save/add/remove errors surfaced |
| 7 | ViewShot capture | FIXED | Gate on canvasDims; CaptureResult (unavailable/failed); status banner; no swallowed errors |
| 8 | Legacy submit error | FIXED | showAlert for all failure paths |
| 9 | Continuation artifact / coord run | FIXED | Backend logs errors instead of silent pass |

---

## Future Milestones

- **Chat intelligent context**: Teacher selects corpus files per assignment; chat uses them as tutoring context
- **Enhanced note-taking**: Grid/lined backgrounds, color palette, stroke width, pinch-to-zoom
- **Analytics**: Daily aggregation — struggle heatmap, engagement metrics, AI-synthesized concept gaps

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
