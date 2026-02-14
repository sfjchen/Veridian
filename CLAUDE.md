# CLAUDE.md

**Running docs**: `AGENTS.md`, `CLAUDE.md`, `README.md`, `PLAN.md`. Update when features, architecture, or conventions change.

## Project Overview

Math Mistake Analysis Platform — full monorepo (teacher + student). Shared Supabase.

- **Teacher**: `teacher/backend/`, `teacher/frontend/` — Flask + React. Classrooms, assignments, corpus, submissions.
- **Student**: `student/backend/`, `student/frontend/` — Flask + Expo. Canvas, mistake analysis, Socratic chat.

## Code Review Process

PRs receive reviews from two automated reviewers:

- **Claude (`claude[bot]` / @claude)**: Leaves feedback as issue comments via MCP. Check via `gh api repos/{owner}/{repo}/issues/{n}/comments` — look for comments from `claude[bot]`.
- **Codex (@codex)**

Address both reviewers' feedback before merging. **Always tag @codex and @claude in PR comments when requesting re-review.**

## Key Directories

| Path | Purpose |
|------|---------|
| `teacher/backend/` | Teacher Flask app (assignments, classrooms, corpus, convert) |
| `teacher/frontend/` | Teacher React app (screens, hooks, components) |
| `student/backend/` | Student Flask (mistake analysis, OCR, chat) |
| `student/backend/get_coords.py` | Main student API server |
| `student/backend/mistake_analysis/` | LLM mistake detection (Claude) |
| `student/backend/src/math_screenshot_to_latex/` | Math OCR (OpenAI) |
| `student/frontend/` | Student Expo app (canvas, document, workspace) |
| `supabase/` | Shared migrations |

## Conventions (from AGENTS.md)

- Follow best industry standards: streamlined, efficient code; no comprehensive testing/docs required
- Type hints on all Python function signatures
- ~20 line max per function
- Flat over nested — early returns, guard clauses
- Max 3 parameters per function
- No premature abstraction
- Minimal comments — code should be self-documenting
