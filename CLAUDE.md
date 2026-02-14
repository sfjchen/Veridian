# CLAUDE.md

**Running docs**: `AGENTS.md`, `CLAUDE.md`, `README.md`, `PLAN.md`, `MIGRATION_GUIDE.md`. Update them when features, architecture, or conventions change.

## Project Overview

Math Mistake Analysis Platform — EdTech for teachers to create assignments and for students to submit solutions with AI-powered mistake analysis. Monorepo:

- **Teacher side**: `backend/`, `frontend/` — Flask + React. Classrooms, assignments, corpus, submissions.
- **Student side**: `student-platform/` — Flask API (`get_coords.py`) + Expo app. Per-problem canvas, mistake analysis, Socratic chat.

Shared Supabase for auth, assignments, problem_results, chat_messages.

## Code Review Process

PRs receive reviews from two automated reviewers:

- **Claude (`claude[bot]` / @claude)**: Leaves feedback as issue comments via MCP. Check via `gh api repos/{owner}/{repo}/issues/{n}/comments` — look for comments from `claude[bot]`.
- **Codex (@codex)**

Address both reviewers' feedback before merging. **Always tag @codex and @claude in PR comments when requesting re-review.**

## Key Directories

| Path | Purpose |
|------|---------|
| `backend/` | Teacher Flask app (assignments, classrooms, corpus, convert) |
| `frontend/` | Teacher React app (screens, hooks, components) |
| `student-platform/` | Student Flask + Expo (mistake analysis, OCR, chat) |
| `student-platform/get_coords.py` | Main student API server |
| `student-platform/mistake_analysis/` | LLM mistake detection (Claude) |
| `student-platform/src/math_screenshot_to_latex/` | Math OCR (OpenAI) |
| `student-platform/frontend/` | Student Expo app (canvas, document, workspace) |
| `supabase/` | Shared migrations |

## Conventions (from AGENTS.md)

- Follow best industry standards: streamlined, efficient code; no comprehensive testing/docs required
- Type hints on all Python function signatures
- ~20 line max per function
- Flat over nested — early returns, guard clauses
- Max 3 parameters per function
- No premature abstraction
- Minimal comments — code should be self-documenting
