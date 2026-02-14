# Veridian: Post-MVP Roadmap

**Running docs**: This file, `AGENTS.md`, `CLAUDE.md`, and `README.md` are the project's living documentation. Update them when features, architecture, or conventions change. Follow best industry coding standards for streamlined, efficient code; comprehensive testing and documentation are not required.

## Current State (as of PR #17)

The following phases are **implemented and in review** on `mvp-improvement`:

### Completed
- **Phase 1a-d**: Per-problem processing pipeline — one problem per screen, KaTeX-rendered headers, 15s idle auto-analysis, per-problem endpoint with assignment context
- **Phase 2a-c**: Red dot annotations — bbox center-point normalization, `MistakeOverlay` component with progressive reveal, hint level filtering (minimal/guided/detailed)
- **Phase 3a**: Per-problem results table — `problem_results` in Supabase with RLS, `result_service.py`
- **Phase 3b**: WebSocket real-time push — `flask-socketio`, `useWebSocket.ts` hook, `emit_result_ready` on analysis complete
- **Phase 5a**: Socratic chat with Claude — `chat.py` with extended thinking, `chat_service.py`, `chat_messages` table, rate limiting (10 msgs/min)
- **Phase 5b**: Chat UI — `ChatPanel.tsx` bottom sheet, `useChat.ts` hook, "Ask about this" in hint bubbles, chat FAB

### Backend services
- `get_coords.py` — Main Flask server (refactored: ~20 line functions, max 3 params)
- `assignment_service.py` — Assignment + problem fetching from Supabase
- `result_service.py` — Per-problem result persistence
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

### Database (Supabase migrations)
- `202602140001_veridian_artifacts.sql` — Artifacts + storage
- `202602140002_assignments_problems.sql` — Assignments + problem_results with RLS
- `202602140003_chat_messages.sql` — Chat messages with RLS

---

## Remaining Phases

### Phase 3c: Background Analysis Worker (partially started)
- `analysis_queue.py` and `worker.py` exist but not committed
- In-process ThreadPoolExecutor queue for async analysis
- Prevents blocking Flask request thread during 10-30s analysis
- **Status**: Files drafted, needs integration and testing

### Phase 3d: Result Loading on App Open
- Fetch `GET /results/{assignment_id}` on document load
- Render persisted dots immediately, then listen for WebSocket updates
- **Status**: Endpoints exist, frontend integration needed

### Phase 4: Teacher Backend Integration
- Resolve all `TODO(teacher-backend)` comments
- Read answer keys from `assignments.answer_key_storage_path`
- Read context from `corpus_files` via `context_file_ids`
- Apply teacher-configured settings (hint_level, reveal_mode, etc.)
- **Status**: Shared Supabase schema ready, integration pending

### Phase 5c-d: Chat Guardrails + Analytics
- Teacher toggles chat per-assignment (`assignments.chat_enabled`)
- Daily 3 PM analytics aggregation: struggle heatmap, engagement metrics, AI-synthesized concept gaps
- **Status**: Not started

### Phase 6: Enhanced Note-Taking
- Grid/lined paper backgrounds
- Color palette (red, blue, green, black)
- Stroke width options
- Pinch-to-zoom
- **Status**: Not started

---

## Tech Debt: Try-Catch Cleanup

### The Problem

During a rapid PR review cycle, we introduced try-catch blocks as fixes for review comments about unhandled errors. While this prevents crashes, it masks root causes — errors are logged or silently swallowed instead of being prevented. In a tutoring app, silent failures mean students think their work was saved/analyzed when it wasn't.

The pattern is consistent: an operation that *can* fail is wrapped in try-catch with a log or silent swallow, when the real fix is to make the operation not fail in the first place (or to handle the specific failure mode with a proper recovery strategy).

### Inventory

#### 1. Backend: Fire-and-forget persistence (`get_coords.py:893-896`)
```python
try:
    upsert_result(student_id, assignment_id, problem_num, payload)
except Exception as exc:
    log.error("Failed to persist result: %s", exc)
```
**What goes wrong**: Supabase transient failures (network blip, connection pool exhaustion, row lock contention) cause the analysis result to be returned to the student but never saved. Next time they open the app, their results are gone.
**Root cause**: No retry logic. Single-shot write to Supabase with no fallback.
**Proper fix**: Retry with exponential backoff (3 attempts, 100ms/500ms/2s). If all retries fail, write to a local dead-letter queue (Redis list or file) and process it on next server startup or via a periodic sweep. Consider Phase 3c's background worker as the retry infrastructure.

#### 2. Backend: WebSocket emit (`get_coords.py:963-966`)
```python
try:
    emit_result_ready(student_id, problem_num, payload)
except Exception as exc:
    log.error("Failed to emit WebSocket result: %s", exc)
```
**What goes wrong**: If the socketio instance isn't initialized (e.g., eventlet not installed, init_socketio failed at startup), every single emit silently fails. Students never get real-time updates and fall back to polling — but we don't have polling implemented, so they just never see results until refresh.
**Root cause**: No health check on the socketio connection. `emit_result_ready` doesn't verify the socket is alive.
**Proper fix**: `websocket_service.py` should expose an `is_healthy() -> bool` check. `emit_result_ready` should be a no-op (not an exception) when socketio isn't initialized. Log a single warning at startup if socketio fails to init, not on every emit. Separately, implement a polling fallback in `useAutoAnalysis` so real-time push is an optimization, not a requirement.

#### 3. Backend: Status update on analysis start (`get_coords.py:916-919`)
```python
try:
    set_result_status(student_id, assignment_id, problem_num, "analyzing")
except Exception as exc:
    log.error("Failed to set analyzing status: %s", exc)
```
**What goes wrong**: If this fails, the student's result row stays in whatever state it was in before. The UI might show stale status ("pending" or "completed" from a prior run) while analysis is actually in progress.
**Root cause**: Status update is best-effort with no guarantee.
**Proper fix**: This is lower severity — the analysis still runs. But the fix is the same retry pattern as #1. Alternatively, the frontend should derive "analyzing" state from the in-flight request itself (which `useAutoAnalysis` already does via `isAnalyzing`), making this server-side status update a nice-to-have rather than a source of truth.

#### 4. Backend: Dot coordinate computation (`get_coords.py:940-945`)
```python
try:
    with Image.open(BytesIO(image_bytes)) as im:
        dims = im.size
    mistakes = _add_dot_coords(mistakes, dims)
except Exception as exc:
    log.error("Failed to compute dot coordinates: %s", exc)
```
**What goes wrong**: If PIL can't read the image (corrupt bytes, unsupported format), students get mistake annotations with no dot positions. The dots simply don't render on screen.
**Root cause**: Image validation happens earlier in the pipeline (during OCR and coord detection), but we re-open the image here without trusting that prior validation. The image bytes are the same — if they worked for Claude vision, they'll work for PIL.
**Proper fix**: Cache `image_dims` from the earlier `_run_mistake_coord_pipeline` call (which already opens the image) and pass it through, eliminating the redundant PIL open. If dims are already known, `_add_dot_coords` can't fail on image parsing.

#### 5. Backend: Mistake coord pipeline in analysis (`get_coords.py:853-857`)
```python
try:
    coords = _run_mistake_coord_pipeline(image_bytes, annotated_tex, mimetype)
    mistakes = coords.get("mistakes", [])
except (ValueError, RuntimeError):
    pass
```
**What goes wrong**: If the coordinate extraction fails (Claude vision returns garbage, JSON parsing fails), we silently return zero mistakes even though the text analysis found errors. The student sees "no mistakes" when there are mistakes — just without bounding boxes.
**Root cause**: Coord extraction is treated as optional enhancement rather than a core part of the pipeline.
**Proper fix**: Return the mistakes with `mistake_count` but no coordinates (instead of empty list). The frontend already handles mistakes without dot positions — it just won't show dots. This preserves the text-based analysis result even when vision-based coord extraction fails. Change the except to set `mistakes = []` but keep `mistake_count` from the earlier annotation parsing.

#### 6. Frontend: Stroke loading (`frontend/app/document/[id].tsx:187`)
```typescript
} catch { /* ignore */ }
```
**What goes wrong**: If AsyncStorage returns corrupt data (partial JSON write from a crash, or schema changed between app versions), strokes silently fail to load. Student's previous work disappears with no indication.
**Root cause**: No data validation or migration. We `JSON.parse` raw storage and hope it's the right shape.
**Proper fix**: Define a schema version for stroke data. Wrap the parse in a validator that checks the expected shape (`Record<number, Stroke[]>`). If the data is corrupt or old format, show a toast ("Previous strokes couldn't be loaded") instead of silent failure. If it's an old schema version, migrate it.

#### 7. Frontend: ViewShot capture (`frontend/app/document/[id].tsx:266-270`)
```typescript
try {
    return await viewShot.capture();
} catch {
    return null;
}
```
**What goes wrong**: Capture fails silently. Auto-analysis triggers with no screenshot, wasting an API call that returns "no image provided."
**Root cause**: ViewShot can fail when the view isn't fully laid out, when running in a background tab, or on certain Android devices with GPU rendering issues. We don't check readiness before capturing.
**Proper fix**: Check `viewShot` readiness state before capture. ViewShot exposes layout events — only enable capture after the first successful layout. Add a `captureReady` state that gates auto-analysis. If capture fails, surface it to `useAutoAnalysis` as a specific error (not null) so it can skip the API call and show "Capture unavailable" in the status banner.

#### 8. Frontend: Legacy submit error (`frontend/app/document/[id].tsx:339-341`)
```typescript
} catch {
    showAlert('Submit failed', 'Check that the Flask server is running.');
}
```
**What goes wrong**: All errors collapse into "check the server" — network errors, auth failures, 500s, timeouts, CORS issues all show the same message.
**Root cause**: No error discrimination. The catch doesn't inspect the error.
**Proper fix**: Use the `isNetworkError` helper (already exists in the codebase) to distinguish network vs server errors. For non-network errors, show the actual error message from the response body. For auth errors (401), prompt re-login. For timeouts, suggest retry.

---

## Design Decisions (locked in)
- One problem per screen, swipe navigation
- Rendered LaTeX headers (KaTeX in WebView)
- 15-second idle debounce for auto-analysis
- WebSockets for real-time result push
- Per-problem result history in Supabase
- Shared Supabase between student and teacher backends
- Persistent chat per-problem, never exposes transcripts to teachers
- Frontend directory: `frontend/` (renamed from `veridian-learning/`)
