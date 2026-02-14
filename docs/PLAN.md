# Teacher Side — Project Plan

See root `PLAN.md` for the merged roadmap (teacher + student).

## Teacher-Specific Completed Work

- PR #1–9: Supabase schema, RLS, Flask backend, teacher/student dashboards, corpus/assignment/submission flows
- PR #10: Column name revert (`prompt_storage_path`)
- PR #11: Admin client, single-step corpus upload
- PR #12: PDF preview fallback, assignment hardening

## Teacher-Specific Remaining Work

- P0: Grading workflow, AI analysis integration, E2E testing
- P1: Submission review with AI, bulk operations
- P2: Due date warnings
- P3: Loading states, error boundaries, responsive design, pagination

## Architecture Decisions (Teacher)

| Decision | Rationale |
|----------|-----------|
| Admin client for all DB queries | RLS + PostgREST joins caused silent failures |
| Single-step file upload UX | Pick-first-then-create is more intuitive |
| `prompt_storage_path` column name | Live DB uses this name |
| Signed URLs via admin client | User JWTs rejected by Storage API |
| PDF screenshot previews via backend | Consistent preview across clients |
| ES256 JWT verification via JWKS | Standard Supabase auth flow |
