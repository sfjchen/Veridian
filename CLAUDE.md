# CLAUDE.md

**Running docs**: `AGENTS.md`, `CLAUDE.md`, `README.md`, `PLAN.md`. Update when features, architecture, or conventions change. When adding packages or env vars: update `requirements.txt` (or `package.json`), `.env.example`, and running docs in the same PR.

## Project Overview

Math Mistake Analysis Platform — full monorepo (teacher + student). Shared Supabase.

- **Teacher**: `teacher/backend/`, `teacher/frontend/` — Flask + React. Classrooms, assignments, corpus, submissions.
- **Student**: `student/backend/`, `student/frontend/` — Flask + Expo. Canvas, mistake analysis, Socratic chat.
- **Student assignment contract**: `GET /assignments/<id>` on student backend is auth + classroom-membership protected and returns merged `resolved_config` used by the student frontend runtime.
- **Assignment problems**: Stored as JSONB array `problems` on the `assignments` table. Each problem: `{ num: int, statement_tex: string }`. Teacher creates/edits via ProblemEditor UI. Student frontend renders one problem per page.
- **Teacher conversion progress**: Socket.IO namespace `/conversion` requires teacher JWT auth (`auth.token`) and job subscription by UUID (`subscribe` with `job_id`).

## Workflow

Push directly to main. No PR review process.

## Key Directories

| Path | Purpose |
|------|---------|
| `teacher/backend/` | Teacher Flask app (assignments, classrooms, corpus, convert) |
| `teacher/frontend/` | Teacher React app (screens, hooks, components). Veridian design system: `src/constants/` (palette, typography, spacing), `src/components/ui/` (Button, Card, Input, Badge, EmptyState, Skeleton, ScreenContainer, Section, Row, ErrorState, TabBar), `src/components/forest/` (TreeIcon, LeafAccent, ForestBackground). Primary: #16A34A. Forest theme: forestCanopy, forestLeaf, forestBark, TreeIcon for empty states. App root is wrapped in `ErrorBoundary` (fallback: message + Retry). |
| `student/backend/` | Student Flask (mistake analysis, OCR, chat) |
| `student/backend/get_coords.py` | Main student API server |
| `student/backend/mistake_analysis/` | LLM mistake detection (Claude) |
| `student/backend/src/math_screenshot_to_latex/` | Math OCR (OpenAI) |
| `student/frontend/` | Student Expo app (canvas, document, workspace) |
| `supabase/` | Shared migrations |

## Design tokens (Veridian)

**Where tokens live:** `teacher/frontend/src/constants/` — canonical source. Student frontend uses the same Veridian values in `student/frontend/constants/` (palette, typography, spacing, motion, theme).

| File | Exports | Use for |
|------|---------|--------|
| `palette.ts` | `palette`, `radius`, `elevation` | Colors (primary #16A34A, surface, card, text, error, success, forestCanopy, forestLeaf, forestBark, forestMist, forestGradientStart/End), radii (button, card, organic 20, etc.), elevation shadows |
| `typography.ts` | `typography`, `fontFamily` | Font families (DM Sans, Dancing Script wordmark), sizes and line heights (display, h1, h2, body, caption, button) |
| `spacing.ts` | `spacing` | 4px grid: padding, margin, gap (xxs 4 → xxxl 64) |
| `motion.ts` | `motion` | Animation durations in ms (fast 150, normal 250, slow 400 for page/modals) |
| `theme.ts` | Re-exports all above | One import for screens/components |

**Rule:** Prefer tokens over raw values. Use `palette.*` for colors, `typography.*` for text styles, `spacing.*` for layout, `motion.*` for `Animated.timing` durations, `radius.*` / `elevation.*` for shape and shadow. No raw hex, ad-hoc font sizes, or magic numbers in UI code. Primitives in `teacher/frontend/src/components/ui/` (Button, Card, Input, etc.) already use these tokens; screens should too.

## Mistake analysis pipeline

End-to-end flow (image → annotated result with coordinates):

1. **Image → LaTeX**: OCR via OpenAI math OCR (`_image_bytes_to_latex` in get_coords; may downscale).
2. **LLM analysis**: `mistake_analysis/client.py` — `MistakeAnalyzer._analyze`: compare student LaTeX to reference + context; tag bank in `constants.py`; JSON mistakes (tag, severity, explanation, erroneous_latex, location_hint). Retry once on parse failure.
3. **Verification**: `_verify`: grader model checks analysis; returns verified_mistakes (original_index, verdict: correct | false_positive | mistagged, optional corrected_tag/severity), missed_mistakes.
4. **Reconciliation**: `_reconcile`: drop FPs, apply mistagged corrections, append missed; normalize tag/severity against `ALL_TAGS`, `SEVERITIES`, `TAG_TO_SEVERITY`.
5. **Annotate**: `_annotate`: find_snippet(erroneous_latex, location_hint); sort (start, -width); dedupe overlapping (keep outermost); reverse; insert `\mistake{...}` / `\mistaketext{...}`; ensure `\input{mistake_preamble}`. See `helpers.py` (find_snippet, in_math_mode).
6. **Continuation**: Optional, in parallel with annotate when `include_solution`; `_continue` returns plain LaTeX continuation.
7. **Coordinate pipeline**: If annotated LaTeX has `\mistake`/`\mistaketext`, get_coords runs vision: original image + annotated LaTeX → Claude; one bbox per annotation id (image pixels, bottom-left origin); parse and validate; merge with annotation fields; add normalized dot (center 0–1) in `_add_dot_coords`.
8. **Postprocess**: `_postprocess_mistakes`: dot coords + hint_level (detailed | minimal | guided per spec).
9. **API**: POST `/analyze-solution` — multipart image; optional assignment_id, problem_num, reference_tex, context_tex, include_solution; context from assignment/problem or form; persist result when assignment_id + problem_num set.

Constants: `mistake_analysis/constants.py` — SEVERITIES, TAG_BANK, ALL_TAGS, TAG_TO_SEVERITY. LaTeX extraction/validation: get_coords `extract_mistake_annotations`, `validate_annotations`.

### Speedups (implemented)

- **OCR image downscaling**: Before math OCR, image is resized so longest side ≤ `MATH_OCR_MAX_IMAGE_SIDE` (default **1024**). LANCZOS resize; smaller images unchanged. Env: `MATH_OCR_MAX_IMAGE_SIDE`. Code: get_coords `_downscale_image_for_ocr`, used in `_image_bytes_to_latex`.
- **Math OCR model and detail**: Screenshot→LaTeX uses OpenAI vision. Default **model** `gpt-4o-mini`, default **image detail** `low`. Env: `MATH_OCR_MODEL`, `MATH_OCR_IMAGE_DETAIL` (e.g. `high` for better quality). Code: `student/backend/src/math_screenshot_to_latex/models.py`, client passes to API.
- **Parallel continuation and annotate**: When `include_solution` is true, continuation LLM call and annotate step run **in parallel** via `ThreadPoolExecutor(max_workers=2)` in `MistakeAnalyzer.run`. Wall time ≈ max(continuation_time, annotate_time).
- **Optional (not done)**: Cache `image_dims` from the coord pipeline and pass into postprocess so `_add_dot_coords` does not open the image again with PIL.

## Conventions (from AGENTS.md)

- Lean development: streamlined, efficient code. Skip comprehensive test suites — tests only for tricky regression-prone logic. No extensive documentation beyond running docs.
- Type hints on all Python function signatures
- ~20 line max per function
- Flat over nested — early returns, guard clauses
- Max 3 parameters per function
- No premature abstraction
- Minimal comments — code should be self-documenting
- **NEVER silently swallow exceptions** — always surface errors to the user or implement proper retry/recovery. No bare `except: pass`, no `catch { /* ignore */ }`. If an operation can fail, handle the failure visibly (toast, error state, retry) rather than hiding it.

## Env layout (dev)

Four `.env` files — one per app — is intentional. Each app loads from its own directory when run (`cd teacher/backend && python run.py`). Shared vars (Supabase) are duplicated; app-specific vars (e.g. `ANTHROPIC_API_KEY` for teacher, `OPENAI_API_KEY` for student) stay isolated. Copy from `.env.example` per app; see README Setup.
