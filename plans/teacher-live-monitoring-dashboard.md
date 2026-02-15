# Teacher Live Monitoring Dashboard

## What Will Be Built And Why

Build a teacher-facing monitoring experience on top of existing backend endpoints:
- live error stream
- live progress stream
- assignment insights
- per-student failure summary

Why:
- Backend monitoring/insight APIs already exist, but teachers currently have no UI surface to use them.
- This converts latent backend capability into operational classroom value.

## Files To Create/Modify

Create:
- `teacher/frontend/src/screens/teacher/AssignmentMonitoringScreen.tsx`
- `teacher/frontend/src/hooks/useLiveMonitoring.ts`
- `teacher/frontend/src/components/monitoring/ProgressHeatList.tsx`
- `teacher/frontend/src/components/monitoring/ErrorTimeline.tsx`
- `teacher/frontend/src/components/monitoring/FailureSummaryCard.tsx`

Modify:
- `teacher/frontend/src/navigation/index.tsx`
- `teacher/frontend/src/screens/teacher/AssignmentScreen.tsx`
- `teacher/frontend/src/lib/api.ts`
- `teacher/frontend/src/types/index.ts`
- `teacher/backend/API_REFERENCE.md`

## PR Breakdown

1. PR 1: Typed API client + hooks
- Add typed wrappers for `/live/errors`, `/live/progress`, `/insights`, `/failure-summary`.
- Add polling and `since` cursor management.

2. PR 2: Monitoring screen MVP
- Add assignment-level monitoring screen with sections: Active/Inactive, Stuck, Top error categories.
- Wire from assignment detail screen.

3. PR 3: Student drill-down
- Add per-student panel showing latest progress, repeated error fingerprints, and recommended actions.

4. PR 4: UX hardening
- Loading/empty/error states, retry controls, and filter controls (`student_id`, `since`, limits).

## Open Questions

1. Polling interval target (e.g., 10s vs 30s) for acceptable freshness vs cost?
2. Should monitoring be read-only in v1, or include intervention actions (message student, adjust config)?
3. Do we need server-pushed updates (WebSocket/SSE) now, or is polling sufficient for first release?

## Success Criteria

- Teachers can open a monitoring view from each assignment.
- Teachers can identify inactive/stuck students and dominant error patterns without leaving the app.
- Per-student failure summary is visible in one click from assignment monitoring.
- Monitoring view remains responsive for classrooms up to agreed size target.

## Agent Team Review (Debate + Consensus)

### Architecture Reviewer
- Recommends hook + typed DTO layer before UI implementation to avoid ad-hoc fetch logic.
- Supports separate monitoring route rather than overloading assignment detail screen.

### Performance Skeptic
- Warns about large payload polling; requests server-side limits and incremental fetch by `since`.
- Suggests virtualization for long student lists.

### Testing Advocate
- Requires contract tests for API response shapes and frontend state tests for empty/error/loading transitions.
- Requires snapshot tests for key risk states (no students, many stuck students, API failure).

### Devil’s Advocate
- Questions signal quality of current heuristic insights and potential teacher trust issues.
- Recommends transparent evidence display alongside recommendations.

### Senior Quantitative Researcher (Tier-1 fund perspective)
- Emphasizes calibration: avoid ranking students by noisy short-term events.
- Requires clear confidence indicators and “insufficient data” handling.
- Recommends preserving raw evidence trails for each recommendation.

### Debate Outcome

Consensus:
- Ship read-only monitoring dashboard first with transparent evidence.
- Use bounded polling + incremental fetch for scale.
- Include explicit low-confidence/insufficient-data states to prevent overinterpretation.

## Revised Plan After Review

1. Implement typed monitoring client and incremental polling.
2. Deliver assignment monitoring dashboard with evidence-first cards.
3. Add student drill-down + failure summary panel.
4. Iterate on confidence calibration after teacher feedback.
