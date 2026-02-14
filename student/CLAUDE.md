# CLAUDE.md (Student)

**Running docs**: `AGENTS.md`, `CLAUDE.md`, `README.md`, `PLAN.md`. See root docs for full platform context.

## Project Overview

Student platform — AI-powered math tutoring pipeline. Backend (`backend/`) for mistake analysis, math OCR, coordinate detection. Frontend (`frontend/`) — React Native/Expo.

## Key Directories

- `get_coords.py` — Flask server: mistake bounding box detection via Claude vision
- `mistake_analysis/` — LLM-based mistake detection, annotation, and continuation
- `src/math_screenshot_to_latex/` — OpenAI-based math OCR (screenshot -> LaTeX)
- `frontend/` — React Native/Expo app (run from `student/` root)

## Conventions

See root `CLAUDE.md` and `AGENTS.md` for all code style rules, review process, and workflow conventions.

- **NEVER silently swallow exceptions** — always surface errors to the user or implement proper retry/recovery. No bare `except: pass`, no `catch { /* ignore */ }`. If an operation can fail, handle the failure visibly (toast, error state, retry) rather than hiding it.
