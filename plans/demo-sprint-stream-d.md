# Stream D — No white screens / resilience (done)

**Goal:** Critical demo paths never white-screen; errors show Retry or a clear message.

## D1 — Spot-check (code review)

| Path | Error handling | White-screen risk |
|------|----------------|-------------------|
| **Teacher** Auth (login/signup) | Validation + `alert` on API failure | No — alert then user can retry |
| Teacher Create classroom | DashboardScreen: `ErrorState` + Retry for list load; create fails → `alert` | No |
| Teacher Create assignment | CreateAssignmentScreen: success → toast (C); API error → `alert`, form remains | No |
| Teacher Upload corpus | CorpusUploadScreen: success → toast (C); API error → `alert` | No |
| Teacher AssignmentScreen | Load → `ErrorState` + Retry; replace file → toast (C) | No |
| Teacher ClassroomScreen | Assignments/corpus/students → `ErrorState` + Retry each; settings → toast (C) | No |
| **Student** Sign in | `alert` on failure | No |
| Student Join with code | JoinClassModal: inline error + retry (no alert only) | No |
| Student Assignments list | `[classroomId].tsx`: error + Retry | No |
| Student Open assignment / document | assignmentError or loadError → CenteredMessage + Back | No — user can navigate back |
| Student Submit solution | WorkspaceScreen: `Alert.alert` on submit failure | No |

**Done when:** Each critical path has a known error handling behavior and no path white-screens. ✓

## D2 — ErrorBoundary and ErrorState + Retry

- **Teacher:** `App.tsx` already wraps root with `<ErrorBoundary>` (AuthProvider, ToastProvider, RootNavigator). ✓
- **Student:** `app/_layout.tsx` now wraps ThemeProvider + Stack with `<ErrorBoundary>`. Uncaught render errors show “Something went wrong” + Retry. ✓
- **Screens that only showed alert:** CreateAssignmentScreen, CorpusUploadScreen, and similar use `alert` on API failure but leave the user on the form (can retry). Not “stuck.” Blocking auth errors (sign up failed, invalid class code) remain as alert by design. ✓

**Done when:** Root ErrorBoundaries in place; every critical screen has ErrorState + Retry or a clear, non-stuck flow. ✓
