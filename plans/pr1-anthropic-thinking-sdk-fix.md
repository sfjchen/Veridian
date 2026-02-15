# PR #1: Fix Anthropic `thinking` SDK Parameter

## What Will Be Built And Why

Fix the P0 backend blocker where Anthropic requests fail with:
`Messages.create() got an unexpected keyword argument 'thinking'`.

Scope is limited to PR #1 in `PLAN.md`:
- add strict Anthropic SDK guardrails (`>=0.79.0`)
- canonicalize `thinking` payloads used by chat and mistake analysis
- add targeted regression tests

## Files To Create/Modify

Create:
- `student/backend/anthropic_guard.py`
- `student/backend/tests/test_anthropic_guard.py`
- `student/backend/tests/test_chat_thinking_params.py`
- `student/backend/tests/test_mistake_analysis_thinking_params.py`

Modify:
- `student/backend/chat.py`
- `student/backend/mistake_analysis/client.py`
- `student/backend/requirements.txt`
- `student/backend/pyproject.toml`
- `student/backend/uv.lock`

## PR Breakdown (Stacked)

1. PR 1A: Dependency contract + SDK guardrails
- add shared runtime validation for Anthropic version/signature support
- enforce deterministic remediation error message for unsupported SDKs
- sync dependency metadata (`requirements`, `pyproject`, `uv.lock`)

2. PR 1B: Canonicalize thinking payload construction
- centralize `thinking` config builders in shared guard module
- use enabled-thinking payload for chat
- use adaptive-thinking payload for mistake analysis

3. PR 1C: Targeted regression tests
- unit tests for version/signature guard behavior
- unit tests for chat thinking payload
- unit tests for mistake-analysis thinking payload

## Open Questions (Resolved)

1. SDK policy:
- chosen: strict `anthropic>=0.79.0` with fail-fast errors

2. Test depth:
- chosen: targeted unit tests (mock-based)

## Success Criteria

- Unsupported Anthropic SDKs fail fast with clear remediation.
- Supported SDKs can call `messages.create(..., thinking=...)` without parameter errors.
- Chat path emits `{"type":"enabled","budget_tokens":...}` thinking config.
- Mistake-analysis path emits `{"type":"adaptive"}` when extended thinking is active.
- New unit tests pass and protect against regressions.

## Agent Team Review (Debate + Consensus)

Architecture reviewer:
- endorsed one shared guard/helper module to remove drift between two call sites.

Performance skeptic:
- accepted runtime check cost as negligible.

Testing advocate:
- required dedicated unit tests for version guard and payload shape.

Devil's advocate:
- challenged extra module; accepted after confirming two critical call sites need one contract source.

Senior quantitative researcher:
- flagged dependency drift risk and supported strict version enforcement for deterministic production behavior.

Consensus outcome:
- proceed with strict SDK enforcement, shared payload builders, and targeted unit tests.
