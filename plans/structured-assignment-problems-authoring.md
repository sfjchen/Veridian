# Structured Assignment Problems Authoring

## What Will Be Built And Why

Build an end-to-end assignment problem authoring workflow so each assignment stores a validated `problems` array (`[{ num, statement_tex }]`) and students always get deterministic per-problem navigation.

Why:
- Student analysis/chat flows are problem-indexed (`assignment_id` + `problem_num`), but teacher assignment creation is currently file-first and does not guarantee structured problem data.
- This closes the contract gap between teacher authoring and student runtime.

## Files To Create/Modify

Create:
- `supabase/migrations/202602150001_add_assignment_problems_json.sql`
- `teacher/backend/app/services/problem_schema.py`
- `teacher/frontend/src/components/ProblemEditor.tsx`

Modify:
- `supabase/all_migrations.sql`
- `teacher/backend/app/routes/assignments.py`
- `teacher/frontend/src/screens/teacher/CreateAssignmentScreen.tsx`
- `teacher/frontend/src/screens/teacher/AssignmentScreen.tsx`
- `teacher/frontend/src/types/index.ts`
- `student/backend/assignment_service.py`
- `student/frontend/lib/api.ts`
- `student/frontend/hooks/useAssignment.ts`

## PR Breakdown

1. PR 1: Schema + backend contract
- Add `assignments.problems jsonb not null default '[]'` with shape validation.
- Validate/sanitize `problems` on create/update.
- Return canonical problems payload in assignment endpoints.

2. PR 2: Teacher authoring UI
- Add `ProblemEditor` for manual problem entry/reordering.
- Require at least one problem to publish assignment.

3. PR 3: Student contract hardening
- Reject assignment problem requests when `problems` is malformed.
- Add strict frontend typing and fallback UX for corrupted payloads.

4. PR 4: Backfill + migration safety
- Backfill legacy assignments to empty/placeholder structure with explicit status.
- Add admin script/check for assignments missing usable problem statements.

## Open Questions

1. Should we require `problems.length >= 1` at DB-level or app-level only?
2. Do we allow rich markup beyond LaTeX (`statement_html`, diagrams), or keep `statement_tex` only for now?
3. Should we parse uploaded PDFs into draft problems automatically, or keep v1 manual-only to reduce OCR/parser risk?

## Success Criteria

- Teacher can create/edit assignments with explicit problem lists.
- Student assignment view consistently opens in problem mode for authored assignments.
- `GET /assignments/:id` always returns a validated `problems` array.
- Analysis/chat flows run against real assignment problem IDs instead of fallback/sample behavior.

## Agent Team Review (Debate + Consensus)

### Architecture Reviewer
- Recommends explicit `problem_schema` validation module and API-level canonicalization to prevent malformed JSON entering the DB.
- Supports migration-first contract before UI rollout.

### Performance Skeptic
- Notes JSONB payload is small; no meaningful runtime risk.
- Warns against heavy server-side PDF parsing in the critical path for v1 authoring.

### Testing Advocate
- Requires endpoint tests for invalid shapes (duplicate `num`, missing `statement_tex`, non-sequential numbers).
- Requires integration test for create -> fetch -> student render path.

### Devil’s Advocate
- Challenges whether manual authoring increases teacher friction.
- Suggests deferring mandatory strictness until parser-assisted drafts exist.

### Senior Quantitative Researcher (Tier-1 fund perspective)
- Flags data integrity risk: non-deterministic problem IDs break longitudinal student analytics.
- Requires immutable problem numbering rules after students start submissions.
- Recommends explicit migration/backfill report to avoid silent coverage gaps.

### Debate Outcome

Consensus:
- Implement strict structured-problem contract now.
- Keep v1 manual authoring (no heavy parser dependency in create flow).
- Enforce deterministic numbering and add validation tests before UI release.

## Revised Plan After Review

1. Ship schema + backend validation first.
2. Add manual teacher problem editor with deterministic numbering.
3. Harden student runtime and analytics assumptions around stable `problem_num`.
4. Defer parser-assisted extraction to a follow-up feature plan.
