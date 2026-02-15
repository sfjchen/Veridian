# Context-Powered Analysis And Chat

## What Will Be Built And Why

Replace MVP placeholder context in student analysis/chat with real assignment context sourced from teacher assets:
- answer key (`assignments.answer_key_storage_path`)
- selected corpus files (`assignments.context_file_ids` -> `corpus_files.storage_path`)

Why:
- Current analysis context has hardcoded fallback text and does not reliably use teacher-authored materials.
- This is the biggest quality lever for mistake detection accuracy and Socratic relevance.

## Files To Create/Modify

Create:
- `student/backend/context_loader.py`
- `student/backend/tests/test_context_loader.py`
- `student/backend/tests/test_assignment_context_resolution.py`

Modify:
- `student/backend/get_coords.py`
- `student/backend/assignment_service.py`
- `student/backend/chat_service.py`
- `student/backend/result_service.py` (store context provenance metadata)
- `teacher/backend/app/routes/assignments.py` (tighten context file validation errors)

## PR Breakdown

1. PR 1: Context loading service
- Add secure loader for assignment answer key + corpus files.
- Add file-type aware extraction (`.tex`, `.md`, `.txt`, `.pdf` text extraction fallback).
- Add TTL/LRU cache to avoid repeated storage fetch costs.

2. PR 2: Analysis pipeline integration
- Replace `_DEFAULT_REFERENCE_TEX` / `_DEFAULT_CONTEXT_TEX` assignment-path behavior.
- Inject resolved reference/context into `analyze-solution` with provenance tags.

3. PR 3: Chat context integration
- Extend chat context builder to include curated assignment context snippets.
- Add token budget strategy (truncate by relevance order, deterministic).

4. PR 4: Failure mode hardening
- Define deterministic fallback behavior when context assets are missing/unreadable.
- Surface actionable error metadata to logs and response diagnostics (without leaking sensitive data).

## Open Questions

1. Should missing answer key block analysis (`4xx`) or degrade gracefully with reduced quality?
2. Which corpus formats are in-scope for v1 extraction beyond plain text and PDF?
3. Should we store extracted context snapshots for reproducibility, or always read latest files?

## Success Criteria

- No assignment-path analysis uses hardcoded default reference/context.
- Chat responses reference assignment-specific content in context block construction.
- Context loading latency stays within agreed SLA (p95 target defined during implementation).
- Clear telemetry exists for context source, fallback reason, and extraction failures.

## Agent Team Review (Debate + Consensus)

### Architecture Reviewer
- Supports dedicated `context_loader` service with strict interface and cache boundaries.
- Recommends provenance metadata so downstream debugging is possible.

### Performance Skeptic
- Warns that PDF extraction can dominate latency and memory if done per request.
- Requires cache + size caps + per-request token budgets.

### Testing Advocate
- Requires fixtures for mixed file types, missing files, and malformed payloads.
- Requires regression test proving assignment analysis no longer depends on static defaults.

### Devil’s Advocate
- Challenges extraction complexity for v1 and suggests text-only first.
- Raises risk of low-quality OCR polluting context.

### Senior Quantitative Researcher (Tier-1 fund perspective)
- Emphasizes anti-leakage: avoid passing full worked solution when hint level is restrictive.
- Requires deterministic truncation and context version tagging for auditability.
- Recommends explicit checks preventing “answer-spill” in tutoring prompts.

### Debate Outcome

Consensus:
- Implement real context loading now with strict caps and deterministic truncation.
- Gate answer-key exposure by resolved `hint_level` policy.
- Defer advanced OCR extraction heuristics until baseline pipeline is stable.

## Revised Plan After Review

1. Ship text/PDF extraction + cache with strict limits.
2. Integrate context into analysis and chat with provenance and guardrails.
3. Add hint-level policy gates to avoid direct answer leakage.
4. Expand extraction sophistication only after baseline quality metrics stabilize.
