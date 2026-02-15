# Wave 3 — Cross-cutting (empty/error/skeleton, motion, a11y)

**Owner:** Wave 3 (World-class UI plan)  
**Prerequisite:** Wave 1 (tokens) and Wave 2 (teacher + student screens) done or in progress.

## Scope

Four tasks, can be done in parallel or as one PR:

| Id | Task | Deliverables |
|----|------|--------------|
| `empty-error-skeleton` | Audit both apps: empty → EmptyState, error → ErrorState/toast, loading → Skeleton/spinner; all use tokens | Student gets EmptyState/ErrorState (and optional Skeleton); all empty/error/loading use them + tokens |
| `motion-use-tokens` | Replace hardcoded Animated durations with motion constants | motion.slow (400) in teacher; Dashboard, Toast, Skeleton use motion.* |
| `a11y-labels` | accessibilityLabel on primary buttons and nav | Teacher: Sign In, New classroom, Create, etc.; student already has many; document Check/Ask/chat |
| `a11y-contrast-touch` | Min 44pt touch targets; contrast; optional reduced-motion | Button sizeSm ≥44pt; verify cards; document or respect reduced-motion for stagger |

## Files to create/modify

### empty-error-skeleton
- **Student:** `student/frontend/components/ui/EmptyState.tsx`, `ErrorState.tsx` (use Veridian palette/typography from student constants). Optionally `Skeleton.tsx` for list loading.
- **Student screens:** `app/(tabs)/index.tsx`, `app/assignments/[classroomId].tsx`, `app/(tabs)/notes.tsx` — use EmptyState for empty, ErrorState for full-screen error (with retry), keep toast/inline for transient errors.
- **Teacher:** Audit only; already uses EmptyState/ErrorState/Skeleton. Ensure no raw hex in those components (already use palette/typography).

### motion-use-tokens
- `teacher/frontend/src/constants/motion.ts` — add `slow: 400`.
- `teacher/frontend/src/screens/teacher/DashboardScreen.tsx` — listFade duration 250 → motion.normal.
- `teacher/frontend/src/components/ui/Toast.tsx` — duration 200 → motion.fast.
- `teacher/frontend/src/components/ui/Skeleton.tsx` — duration 600 → motion.slow (400) or keep 600 as pulse (no token); use motion.slow for consistency.

### a11y-labels
- Teacher: `LoginScreen.tsx`, `SignupScreen.tsx` — Button accessibilityLabel "Sign In" / "Sign up" / "Create account"; links "Forgot password", "Go to sign up".
- Teacher: `DashboardScreen.tsx` — "New classroom", modal "Create" → "Create classroom", "Cancel" → "Cancel".
- Teacher: `ClassroomScreen.tsx`, `CreateAssignmentScreen.tsx`, `CorpusUploadScreen.tsx`, `AssignmentScreen.tsx` — primary Buttons get accessibilityLabel.
- Student: document screen "Check", "Ask", chat input already labeled; verify and document in CLAUDE if needed.

### a11y-contrast-touch
- `teacher/frontend/src/components/ui/Button.tsx` — sizeSm minHeight 36 → 44 (or add a token MIN_TOUCH_SM that is 44).
- Audit Card / TouchableOpacity in teacher and student: ensure minHeight or padding yields ≥44pt touch target where tappable.
- Optionally: respect `prefers-reduced-motion` for Dashboard list stagger (disable or shorten delay).

## PR strategy

- **Option A:** One PR "feat/wave3-cross-cutting" with all four tasks.
- **Option B:** Two PRs: (1) empty-error-skeleton + motion-use-tokens, (2) a11y-labels + a11y-contrast-touch.

Recommendation: One PR to keep review atomic and avoid merge conflicts.

## Success criteria

- Every empty list in teacher and student uses EmptyState (or equivalent with one CTA).
- Every full-screen error uses ErrorState (message + retry) or toast for transient.
- Loading: Skeleton where structure known, else spinner; tokens for colors.
- No hardcoded Animated duration in teacher; all from motion.ts.
- Primary actions and nav have accessibilityLabel in teacher (student already largely done).
- Buttons and key tappable areas ≥44pt; contrast verified.

## Implementation (done)

- **motion-use-tokens:** Added `motion.slow: 400` in teacher `motion.ts`. Dashboard list fade uses `motion.normal`, Toast and Skeleton use `motion.fast` / `motion.slow`.
- **a11y-labels:** Teacher Button accepts optional `accessibilityLabel`. Added labels to Login, Signup, Dashboard (New classroom, Cancel, Create classroom), ClassroomScreen (New assignment, Upload file), CreateAssignmentScreen, CorpusUploadScreen, ErrorState Retry.
- **a11y-contrast-touch:** Teacher Button `sizeSm` minHeight set to 44 (MIN_TOUCH).
- **empty-error-skeleton:** Student: added `constants/theme.ts` (spacing, typography), `components/ui/EmptyState.tsx`, `components/ui/ErrorState.tsx`. Extended palette with `error`, `textOnPrimary`, `overlay`, `radius.input`, `radius.modal`. Classes screen and Assignments screen use EmptyState for empty and ErrorState for error; Notes screen uses EmptyState for empty. Teacher: already using EmptyState/ErrorState/Skeleton; no change.
