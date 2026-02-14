# Teacher Backend API Additions

## OpenAPI Endpoint

- `GET /docs/openapi.json`
  - Returns an OpenAPI-style summary of all backend endpoints added in this change.

## Live Monitoring

- `POST /assignments/{assignment_id}/live/errors` (student)
  - Ingests a live error event.
  - Body:
    - `error_message` (string, required)
    - `assignment_part` (string, optional)
    - `topic` (string, optional)
    - `error_fingerprint` (string, optional)
    - `metadata` (object, optional)
    - `occurred_at` (ISO-8601 string, optional)

- `GET /assignments/{assignment_id}/live/errors` (teacher/student)
  - Query:
    - `student_id` (teacher only, optional)
    - `since` (ISO-8601, optional)
    - `limit` (int, optional)
  - Response note: When the requester is a teacher, each log entry includes a `student_display_name` field (string). This field is absent for student requests.

- `POST /assignments/{assignment_id}/live/progress` (student)
  - Ingests a progress event.
  - Body:
    - `completion_percentage` (0-100, required)
    - `state` (`not_started|in_progress|stuck|completed`, optional)
    - `assignment_part` (string, optional)
    - `topic` (string, optional)
    - `active_error_fingerprint` (string, optional)
    - `metadata` (object, optional)
    - `last_active_at` (ISO-8601 string, optional)

- `GET /assignments/{assignment_id}/live/progress` (teacher/student)
  - Query:
    - `student_id` (teacher only, optional)
    - `since` (ISO-8601, optional)
    - `limit` (int, optional)
    - `include_events` (`true|false`, optional)
  - Response note: When the requester is a teacher, each progress record includes a `student_display_name` field (string). This field is absent for student requests.

## Pedagogical Insights

- `GET /assignments/{assignment_id}/insights` (teacher)
  - Returns:
    - `common_stumbling_blocks` (> threshold of class failing by assignment part)
    - `engagement_metrics` (inactive students + stuck students)
    - `concept_mastery` (mastered vs needs review topics)
  - Query:
    - `failing_ratio_threshold` (0-1, optional, default `0.30`)
    - `inactivity_minutes` (int, optional, default `30`)
    - `stuck_minutes` (int, optional, default `20`)
    - `stuck_repeat_threshold` (int, optional, default `3`)
    - `mastery_target` (0-1, optional, default `0.70`)
    - `min_topic_events` (int, optional, default `3`)
    - `since` (ISO-8601, optional)
    - `error_limit` / `progress_limit` (int, optional)

- `GET /assignments/{assignment_id}/students/{student_id}/failure-summary` (teacher or owning student)
  - Returns assignment-specific explanation of failure risk:
    - `failure_reasons`
    - `recommended_actions`
    - evidence (completion, inactivity, repeated errors, dominant categories/topics)

## Expected Live Data Tables

These endpoints assume the following Supabase tables exist:

- `assignment_error_logs`
- `assignment_progress_events`

The backend writes these fields:

- `assignment_id`, `classroom_id`, `student_id`
- `assignment_part`, `topic`
- `error_message`, `error_category`, `error_fingerprint`, `metadata`, `occurred_at` (errors)
- `completion_percentage`, `state`, `active_error_fingerprint`, `metadata`, `last_active_at` (progress)
