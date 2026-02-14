# CLAUDE.md

**Running docs**: This file, `AGENTS.md`, `README.md`, and `PLAN.md` are the project's living documentation. Update them when features, architecture, or conventions change.

## Project Overview

Student platform — AI-powered math tutoring pipeline. Backend services for mistake analysis, math OCR, and coordinate detection. Includes a React Native/Expo frontend (`frontend/`).

## Code Review Process

PRs receive reviews from two automated reviewers:

- **Claude (`claude[bot]` / @claude)**: Leaves feedback as issue comments via MCP. Check via `gh api repos/{owner}/{repo}/issues/{n}/comments` — look for comments from `claude[bot]`.
- Codex (@codex)

Address both reviewers' feedback before merging. **Always tag `@claude` and @codex in PR comments when requesting re-review.**

## Key Directories

- `mistake_analysis/` — Python package: LLM-based mistake detection, annotation, and continuation
- `src/math_screenshot_to_latex/` — OpenAI-based math OCR (screenshot → LaTeX)
- `get_coords.py` — Flask server: mistake bounding box detection via Claude vision
- `frontend/` — React Native/Expo frontend app
- `scripts/` — Backend capture servers (Claude, Gemini, OpenRouter)

## Conventions (from AGENTS.md)

- Follow best industry standards: streamlined, efficient code; no comprehensive testing/docs required
- Type hints on all Python function signatures
- ~20 line max per function
- Flat over nested — early returns, guard clauses
- Max 3 parameters per function
- No premature abstraction
- Minimal comments — code should be self-documenting
