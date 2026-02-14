# High School Algebra Sample Worksheet (Supabase)

## What Will Be Built And Why

Build a single-problem high school algebra worksheet, its worked solution, and a reproducible upload path so the sample is stored in Supabase for app/backend testing.

Why:
- We need a deterministic sample artifact to validate ingestion, retrieval, and downstream worksheet workflows.

## Files To Create/Modify

Create:
- `supabase/migrations/202602140002_veridian_sample_worksheets.sql` (if DB-seed path is selected)

Modify:
- `SUPABASE_INTEGRATION.md` (document sample worksheet upload/seed flow)

## PR Breakdown

1. PR 1: Supabase insertion path
- Add migration to store sample worksheet rows in Supabase.

2. PR 2: Docs + verification
- Update integration docs.
- Add run instructions and verification query/API checks.

## Open Questions

1. Preferred storage target:
- Option A: `veridian_artifacts` + Storage bucket (requires `SUPABASE_SERVICE_ROLE_KEY`).
- Option B: DB-seeded sample table/content row (works with current `SUPABASE_DB_URL` availability).

2. Ownership model:
- If inserting into `veridian_artifacts`, which `auth.users.id` should own the sample rows?

3. Retrieval contract:
- Should consumers read this as artifact rows, or as a dedicated sample worksheet dataset?

## Success Criteria

- Worksheet and solution content exists in Supabase only (not in repository files).
- Supabase contains corresponding sample data (artifact rows or sample table rows).
- A reproducible command adds/verifies the sample without manual dashboard edits.
- Documentation explains how to re-run and validate.

## Agent Team Review (Debate + Consensus)

### Architecture Reviewer
- Recommends artifact-table insertion only if service-role credentials are present; otherwise use DB migration/seed with explicit schema.
- Flags that artifact rows require valid `owner_id` foreign keys and storage path semantics.

### Performance Skeptic
- Data volume is tiny; no memory/CPU risk.
- Prefers static seed content over runtime generation for deterministic behavior.

### Testing Advocate
- Requires a verification step:
  - SQL: row count + exact title/problem text check.
  - Optional API check if artifacts path is used.
- Wants failure mode handling in script (missing env vars, duplicate insert behavior).

### Devil’s Advocate
- Challenges adding a new table if existing artifact model already exists.
- Suggests dual-path uploader only if complexity is kept low and explicit.

### Senior Quantitative Researcher (Tier-1 fund perspective)
- Validates sample determinism and reproducibility.
- Rejects ambiguous transformation logic; content must be fixed and auditable.
- Requires explicit avoidance of hidden assumptions (no implicit owner mapping, no inferred symbol aliases).
- Recommends idempotent insertion semantics to avoid duplicate sample contamination in production-like environments.

### Debate Outcome

Consensus:
- Keep deterministic sample content in Supabase.
- Implement one robust ingestion path aligned to available credentials.
- Prefer idempotent insert behavior and explicit validation checks.
- Keep schema and content minimal to reduce integration risk.

## Revised Plan After Review

1. Implement DB-seed migration path so the sample is added directly to Supabase.
2. Document exact commands for insertion and verification.
