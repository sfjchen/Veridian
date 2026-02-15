# tokens-motion — Motion token + optional palette

**Owner:** tokens-motion (World-class UI plan, Wave 1)  
**Goal:** Add `motion.slow` (400ms) for page/modal transitions; optionally add semantic/dark-ready keys to palette.

## What will be built

- **Required:** `motion.slow: 400` in `teacher/frontend/src/constants/motion.ts` for use by Animated.timing and stack/modal transitions.
- **Optional:** Semantic/dark-ready structure in `teacher/frontend/src/constants/palette.ts` (e.g. `feedback.success` / `feedback.error` aliases or `dark.surface` placeholders). Palette already has `error`, `success`, `warning`; dark-ready is for future theme switching.

## Files to create/modify

| File | Change |
|------|--------|
| `teacher/frontend/src/constants/motion.ts` | Add `slow: 400` to `motion` object. |
| `teacher/frontend/src/constants/palette.ts` | Optional: add `feedback` or `dark` key structure. |

## PR and branch strategy

| Step | Action | Branch | Worktree |
|------|--------|--------|----------|
| 1 | Create feature branch from `main` | `feat/tokens-motion` | — |
| 2 | (Optional) Create worktree: `git worktree add .worktrees/tokens-motion -b feat/tokens-motion main` | same | `.worktrees/tokens-motion` |
| 3 | Implement motion.slow (+ optional palette) on branch | `feat/tokens-motion` | repo or worktree |
| 4 | Open PR from `feat/tokens-motion` → `main` | — | — |

**Single PR:** One small PR containing motion.slow and, if done, optional palette changes. No separate PRs for optional palette to avoid churn.

## Success criteria

- `motion.slow` is exported and equals 400.
- Existing `motion.fast` (150) and `motion.normal` (250) unchanged.
- No raw duration numbers added elsewhere; this PR only adds the token (consumption is in later `motion-use-tokens` work).

## Open questions

- Include optional semantic/dark-ready palette keys in this PR or leave for a follow-up? **Decision:** Omit for this PR; keep scope to motion only. Palette can be done in tokens-docs or a tiny follow-up.
