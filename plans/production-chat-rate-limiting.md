# Production Chat Rate Limiting

## What Will Be Built And Why

Replace the student backend in-memory chat limiter with a restart-safe, multi-instance-safe limiter backed by Supabase.

Why:
- Current limiter (`max 10/min`) is process-local and resets on restart.
- It does not protect reliably in horizontally scaled deployments.

## Files To Create/Modify

Create:
- `supabase/migrations/202602150002_create_chat_rate_limit_windows.sql`
- `student/backend/chat_rate_limit_service.py`
- `student/backend/tests/test_chat_rate_limit_service.py`

Modify:
- `supabase/all_migrations.sql`
- `student/backend/get_coords.py`
- `student/backend/chat.py`
- `student/backend/requirements.txt` (only if a new dependency is introduced)

## PR Breakdown

1. PR 1: Schema + atomic update contract
- Add `chat_rate_limit_windows` keyed by `(student_id, window_start)`.
- Implement atomic increment + window check logic.

2. PR 2: Backend integration
- Replace `_chat_timestamps` in-memory logic with service calls.
- Preserve identical API behavior (`429` with clear message).

3. PR 3: Observability + controls
- Add env-configurable limits (`CHAT_RATE_LIMIT`, `CHAT_RATE_WINDOW_SECONDS`).
- Add structured stderr logs/metrics for throttled requests.

4. PR 4: Tests + replay safety
- Add concurrency tests and restart simulation tests.
- Validate behavior under duplicate retries.

## Open Questions

1. Sliding window vs fixed window for v1 (accuracy vs implementation complexity)?
2. Should sample assignment traffic share the same limit bucket as production assignments?
3. Do we need per-classroom/assignment override limits from teacher config, or keep global defaults first?

## Success Criteria

- Rate limiting behavior is consistent across restarts and multiple backend instances.
- `429` responses are deterministic under concurrent chat bursts.
- No measurable regression in chat median latency from limiter checks.
- Configurable limits can be tuned without code changes.

## Agent Team Review (Debate + Consensus)

### Architecture Reviewer
- Recommends dedicated limiter service module and atomic DB update path.
- Prefers Supabase-backed fixed windows for initial reliability.

### Performance Skeptic
- Warns about DB hot rows under high traffic if using coarse windows.
- Suggests narrow window keying and retention cleanup policy.

### Testing Advocate
- Requires concurrency tests and invariant checks around exact threshold boundaries.
- Requires integration tests for `429` recovery after window rollover.

### Devil’s Advocate
- Challenges DB-backed limiter cost; proposes external Redis.
- Accepts Supabase-first path if traffic is moderate and retention is controlled.

### Senior Quantitative Researcher (Tier-1 fund perspective)
- Requires deterministic, auditable throttling decisions.
- Flags operational risk if limiter produces nondeterministic behavior near the threshold.
- Recommends explicit timestamp normalization (UTC) and reproducible boundary logic.

### Debate Outcome

Consensus:
- Implement fixed-window Supabase limiter first (simple, deterministic, audit-friendly).
- Add cleanup policy and metrics for hot-key monitoring.
- Revisit Redis only if throughput demands exceed DB comfort.

## Revised Plan After Review

1. Ship Supabase fixed-window limiter with atomic increments.
2. Integrate into `/chat` endpoint with same response contract.
3. Add observability and load tests for boundary cases.
4. Reassess architecture with production traffic data.
