# Teacher Config Contract Parity

## What Will Be Built And Why

Create a single-source config contract workflow across teacher backend, student backend, and teacher frontend so runtime config fields cannot drift.

Why:
- The backend supports `analysis_trigger=auto_page_change`, but teacher frontend type/options currently lag behind.
- Config drift risks silent feature disablement and inconsistent classroom behavior.

## Files To Create/Modify

Create:
- `teacher/frontend/src/lib/configContract.ts`
- `scripts/check_config_contract_sync.sh`
- `teacher/frontend/src/components/config/ConfigOptionRegistry.ts`

Modify:
- `teacher/frontend/src/types/index.ts`
- `teacher/frontend/src/components/ConfigEditor.tsx`
- `teacher/backend/app/services/config_schema.py`
- `student/backend/config_schema.py`
- `scripts/check_config_schema_sync.sh`
- `README.md`

## PR Breakdown

1. PR 1: Frontend parity fix
- Add missing `auto_page_change` to teacher frontend type/options.
- Ensure editor and saved payloads preserve the new enum.

2. PR 2: Shared contract representation
- Introduce frontend registry derived from backend schema constants (build-time sync artifact or strict mirror check).
- Remove hand-maintained enum duplication where possible.

3. PR 3: CI guardrails
- Extend sync checks to include frontend contract parity.
- Fail CI on enum/default/range divergence.

4. PR 4: UX polish
- Improve config editor labeling/help text for each mode (`auto_idle`, `auto_page_change`, `manual_only`, `passive`).

## Open Questions

1. Should frontend contract be generated automatically from backend schema, or validated as a manually mirrored file?
2. Where should config copy/labels live if we later add localization?
3. Should config unknown fields be hard-rejected in frontend or silently ignored with warning telemetry?

## Success Criteria

- Teacher UI can configure all backend-supported config values, including `auto_page_change`.
- CI catches any config enum/default/range mismatch across teacher backend, student backend, and teacher frontend.
- No runtime config field is silently dropped during create/edit assignment flows.

## Agent Team Review (Debate + Consensus)

### Architecture Reviewer
- Recommends explicit contract registry and automated parity checks instead of tribal/manual sync.
- Supports minimal generation tooling if it reduces drift.

### Performance Skeptic
- Notes negligible runtime overhead; prefers build-time validation only.

### Testing Advocate
- Requires unit tests for config editor serialization and round-trip API payload integrity.
- Requires CI test proving detection of intentional mismatch.

### Devil’s Advocate
- Questions whether additional sync scripts increase maintenance burden.
- Accepts if scripts are small, deterministic, and fail loudly.

### Senior Quantitative Researcher (Tier-1 fund perspective)
- Flags model-risk analogy: configuration drift creates hidden regime changes.
- Requires versioned, auditable config contract to preserve reproducibility of outcomes.
- Recommends explicit contract change logs in PR templates.

### Debate Outcome

Consensus:
- Fix immediate parity gap now (`auto_page_change`).
- Add lightweight contract checks across backend/frontend to prevent future drift.
- Keep tooling minimal and deterministic.

## Revised Plan After Review

1. Patch teacher frontend parity immediately.
2. Add contract sync checks covering backend and frontend.
3. Establish config contract as auditable artifact for future feature expansion.
