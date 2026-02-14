# Supabase Integration (Artifacts + Coordinate Runs)

This backend now supports Supabase-backed artifact handling for `.tex` files and screenshots.

## Endpoints

- `POST /artifacts/upload-url` (auth required)
  - Body: `artifact_type`, `filename`, `mime_type`, optional `byte_size`, optional `metadata`
  - Returns artifact row + signed upload URL/token.

- `POST /artifacts/confirm-upload` (auth required)
  - Body: `artifact_id`
  - Marks the artifact as uploaded.

- `POST /artifacts/screenshot-to-latex` (auth required)
  - Body: `screenshot_artifact_id`
  - Downloads screenshot, runs image-to-latex (GPT-5.2), stores result as latex artifact in Supabase.
  - Returns `{ artifact, latex }`. Requires `OPENAI_API_KEY`.

- `GET /artifacts` (auth required)
  - Query: optional `artifact_type`, optional `limit`
  - Returns user-owned artifacts with signed download URLs for uploaded files.

- `GET /artifacts/:artifact_id/download-url` (auth required)
  - Returns a fresh signed download URL.

- `POST /mistake-coords/from-artifacts` (auth required)
  - Body: `screenshot_artifact_id`, `latex_artifact_id`
  - Downloads files from Supabase Storage, runs Claude coordinate extraction, stores run output, and returns coordinates.

- `POST /api/capture` (app capture pipeline)
  - Body: base64 `image`, optional `documentId`, optional `sample_slug`, optional `reference_tex`, optional `context_tex`
  - Flow: screenshot artifact upload -> image-to-latex -> OCR latex artifact upload -> revised/annotated latex artifact upload -> coordinate run.
  - Ownership: bearer token user if provided; otherwise `SUPABASE_DEFAULT_OWNER_ID` must be set.

Existing `POST /mistake-coords` multipart flow still works unchanged for direct file uploads.

## Sample worksheet data

Worksheet sample content is stored in Supabase only and is not checked into this repository.
The table used for sample worksheet rows is:

- `public.veridian_sample_worksheets`

Seed command (idempotent upsert). Replace the `:placeholder` values with actual
worksheet content before running in the Supabase SQL editor or a migration tool:

```sql
insert into public.veridian_sample_worksheets (
    slug,
    title,
    subject,
    grade_level,
    problem_count,
    worksheet_text,
    solution_text,
    metadata
)
values (
    :slug,
    :title,
    :subject,
    :grade_level,
    :problem_count,
    :worksheet_text_latex,
    :solution_text_latex,
    :metadata_jsonb
)
on conflict (slug)
do update set
    title = excluded.title,
    subject = excluded.subject,
    grade_level = excluded.grade_level,
    problem_count = excluded.problem_count,
    worksheet_text = excluded.worksheet_text,
    solution_text = excluded.solution_text,
    metadata = excluded.metadata;
```

Verification:

```sql
select slug, title, problem_count, updated_at
from public.veridian_sample_worksheets
where slug = :slug;
```

## Migration

Apply in order:

- `supabase/migrations/202602140001_veridian_artifacts.sql`
- `supabase/migrations/202602140002_veridian_sample_worksheets.sql`

Creates:

- `public.veridian_artifacts`
- `public.veridian_mistake_coord_runs`
- `public.veridian_sample_worksheets`
- Storage bucket `veridian-artifacts`
- RLS + storage policies scoped to authenticated user ownership.

## Bucket behavior

- The backend and migration both use a fixed bucket: `veridian-artifacts`.
- `SUPABASE_ARTIFACTS_BUCKET` overrides are intentionally not supported to keep policy/bucket behavior consistent.
