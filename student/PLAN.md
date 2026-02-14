# Veridian Student: Post-PR #22 Roadmap

**Running docs**: `AGENTS.md`, `CLAUDE.md`, `README.md`, `PLAN.md`. Update when features, architecture, or conventions change.

## Current State (post-PR #22)

Teacher backend now has classroom and assignment CRUD (PR #22), corpus management (PR #23), and live monitoring (PR #21). Student backend has the full analysis + chat pipeline. The next phase shifts focus to making the student app assignment-driven, teacher-controlled, and production-quality.

### Completed

- **Per-problem pipeline**: One problem per screen, KaTeX-rendered headers, 15s idle auto-analysis, per-problem endpoint with assignment context
- **Red dot annotations**: bbox center-point normalization, `MistakeOverlay` with progressive reveal, hint level filtering
- **Results persistence**: `problem_results` in Supabase with RLS, `result_service.py`, retry + dead-letter queue
- **WebSocket real-time push**: `flask-socketio`, `useWebSocket.ts`, `emit_result_ready`
- **Socratic chat**: `chat.py` with extended thinking, `chat_service.py`, `chat_messages` table, rate limiting
- **Chat UI**: `ChatPanel.tsx` bottom sheet, `useChat.ts`, "Ask about this" in hint bubbles, chat FAB
- **Teacher CRUD**: Classrooms, assignments, corpus files (PRs #21-23)

### Backend services

- `get_coords.py` — Main Flask server (refactored: ~20 line functions, max 3 params)
- `assignment_service.py` — Assignment + problem fetching from Supabase
- `result_service.py` — Per-problem result persistence with retry + DLQ
- `chat.py` — Socratic tutoring with Claude (claude-sonnet-4-5 + extended thinking)
- `chat_service.py` — Chat history persistence
- `websocket_service.py` — Real-time WebSocket push via flask-socketio
- `auth_middleware.py` — JWT authentication middleware

### Frontend (`frontend/`)

- `app/document/[id].tsx` — Per-problem canvas with auto-analysis
- `components/MistakeOverlay.tsx` — Red dots with progressive reveal
- `components/ChatPanel.tsx` — Socratic chat bottom sheet
- `components/ProblemHeader.tsx` — KaTeX rendering via WebView
- `hooks/useAutoAnalysis.ts` — 15s idle debounce with error callbacks
- `hooks/useAssignment.ts` — Assignment data fetching
- `hooks/useChat.ts` — Chat with optimistic updates
- `hooks/useWebSocket.ts` — Real-time result push
- `lib/api.ts` — API client with typed endpoints

---

## New Roadmap

The student notebook overhaul has 6 parallel tracks. The core shift: **assignment-driven flow** (teacher uploads everything, students just solve) with **invisible analysis** (no spinners, no manual triggers unless teacher configures it) and **teacher-controlled behavior** (config system controls every aspect of what students see).

### PR 1: Fix Anthropic `thinking` SDK Parameter

**Status**: Not started
**Priority**: P0 — blocks both analysis and chat

The `thinking` parameter format in `client.py` and `chat.py` causes `Messages.create() got an unexpected keyword argument 'thinking'` errors. Fix the parameter format to match what `anthropic>=0.79.0` expects.

**Files**: `mistake_analysis/client.py` (line 112), `chat.py` (lines 81-84)

### PR 2: Student Home Screen — Classrooms > Assignments

**Status**: Not started
**Priority**: P0

Replace the "Library" / "Add PDF" flow with an assignment-driven home screen. Students see their classrooms, tap to see assignments, tap an assignment to open the canvas. No student-initiated PDF uploads.

**Key changes**:
- Replace `LibraryScreen` with `ClassroomsScreen` (card grid)
- New `AssignmentsScreen` for per-classroom assignment list
- Strip out PDF upload UI and legacy document management
- Wire assignment tap to existing `DocumentScreen` in problem mode

### PR 3: Teacher Config System (Classroom Defaults + Assignment Overrides)

**Status**: Not started
**Priority**: P1

Add teacher-controlled config that governs student behavior: check button visibility, dot threshold, analysis trigger mode, notification style, chat enabled/disabled. Classroom-level defaults with per-assignment overrides.

**Config fields**: `check_button_visible`, `dot_threshold`, `max_dots_shown`, `analysis_trigger` (auto_idle/auto_page_change/manual_only/passive), `notification_style` (silent/toast/badge), `chat_enabled`

**Student backend**: `assignment_service.py` gets `get_resolved_config()` — merges classroom defaults with assignment overrides.

### PR 4: Student App Reads Teacher Config (depends on PR 3)

**Status**: Not started
**Priority**: P1

Make the student frontend respect all teacher config fields. Remove the "Analyzing..." spinner, conditionally render Check button, gate chat on `chat_enabled`, apply `dot_threshold` and `max_dots_shown` in `MistakeOverlay`, apply `analysis_trigger` mode in `useAutoAnalysis`.

### PR 5: Eliminate All Silent Failures

**Status**: Not started
**Priority**: P1

Fix remaining silent failure patterns. See Tech Debt section below for item-by-item status.

### PR 7: Shared Design System + Visual Overhaul

**Status**: Not started
**Priority**: P2

Create `packages/design/` with Veridian branding (green-primary #16A34A), shared components (Card, Button, Toast, Skeleton, EmptyState, ErrorState), and apply across both frontends. Notability-like minimal canvas UX. Card grid navigation.

---

## Tech Debt: Silent Failure Inventory

| # | Item | Status | Action |
|---|------|--------|--------|
| 1 | Fire-and-forget persistence | FIXED (retry + DLQ) | No action |
| 2 | WebSocket emit | STILL PRESENT | Add `is_healthy()` check; no-op when uninitialized |
| 3 | Status update on analysis | FIXED (retry) | No action |
| 4 | Dot coordinate computation | PARTIALLY FIXED | Cache `image_dims` from pipeline, pass through |
| 5 | Mistake coord pipeline | STILL PRESENT | Keep `mistake_count`, return mistakes without coords |
| 6 | Stroke loading | PARTIALLY FIXED | Add schema validation + toast on corrupt data |
| 7 | ViewShot capture | IMPROVED | Add `captureReady` gating |
| 8 | Legacy submit error | IMPROVED | Add 401 handling, show actual error messages |

---

## Design Decisions (locked in)

- **Assignment-driven flow** — teacher uploads everything, students open assignments to solve
- **Invisible analysis** — no spinners, no "Analyzing..." bar; teacher config controls triggers
- One problem per screen, swipe navigation
- Rendered LaTeX headers (KaTeX in WebView)
- Configurable analysis trigger (default: 15s idle debounce)
- WebSockets for real-time result push
- Per-problem result history in Supabase
- Shared Supabase between student and teacher backends
- Persistent chat per-problem, never exposes transcripts to teachers

---

## Future Milestone: Chat Intelligent Context

Teacher marks "relevant texts from corpus" for a given assignment. Chat uses those marked texts as context when tutoring. Requires:
- Teacher UI to select corpus files per assignment
- Backend to fetch + inject selected corpus text into chat system prompt
- Context window management (truncation strategy for large corpus)

_To be planned after the above PRs land._
