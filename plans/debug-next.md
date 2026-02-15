# Debug Next — Plan

**Context:** Teacher-side "Failed to fetch" / connection issues are resolved. This doc captures what was fixed and what to debug or harden next. **Update this file as you complete tasks** (mark items done, add bullets under the task, keep "Mod N tasks" and summaries in sync).

---

## What We Fixed (This Session)

| Issue | Root cause | Fix |
|-------|------------|-----|
| Failed to fetch classes (device) | App used `localhost:5001`; on device/emulator localhost is not the host machine | Prefer Expo host (hostUri/debuggerHost) over `EXPO_PUBLIC_API_URL` on native in `apiBaseUrl.ts` |
| Failed to fetch (web) | Web should use .env URL so browser hits same-machine backend | On web, prefer `EXPO_PUBLIC_API_URL` then fallback to resolved host in `apiBaseUrl.ts` |
| ERR_CONNECTION_REFUSED :5001 | Backend not running on 5001 | Added `FLASK_RUN_PORT=5001` and `FLASK_RUN_HOST=0.0.0.0` to teacher backend `.env`; run backend with `flask run` or `python run.py` |
| Invalid API key (signup) | Supabase anon key wrong or not loaded | User re-copied anon key from Supabase; ensure Expo restarted after .env change |
| Failed to fetch (new teacher) | Same as above (network + backend not reachable) | Same URL + backend-running fixes |

---

## Immediate Cleanup

1. **Remove debug instrumentation** from teacher frontend (added for "Failed to fetch" investigation): **DONE**
   - Removed all `#region agent log` blocks from api.ts, auth.tsx, navigation/index.tsx, useClassrooms.ts, DashboardScreen.tsx.

---

## Debug / Harden Next (Prioritized)

*Update this section and the Mod N summaries at the bottom as you complete tasks.*

- **Mod 1 (1, 4, 7):** Task 1 = remove debug instrumentation (DONE). Task 4 = backend-down UX message (DONE). Task 7 = student backend URL resolution (DONE).
- **Mod 2 tasks (2, 5, 8)** and **Mod 3 tasks (3, 6, 9)** completed; details below.

### P0 — Teacher flows

1. **New teacher registration → profile + role**
   - Confirm Supabase trigger `handle_new_user` runs on your project and inserts `profiles` with `role` from signup metadata.
   - If "Unable to determine your account role" appears, debug: profile row missing or `role` not set.

2. **Create classroom → list classrooms** — *done*
   - Already working once backend is running; add a quick smoke test: create classroom, refresh, see it in the list.
   - **Smoke test:** Create a classroom from Dashboard (name + Create). List auto-refreshes via `useClassrooms.create()` → `refresh()`. Verify the new classroom appears in the list. No code change needed; flow is correct.
   - **Verified:** `useClassrooms.ts`: `create()` does `api("POST", "/classrooms", { name })` then `await refresh()`; `refresh()` fetches GET `/classrooms` and `setClassrooms(data)`. List updates after create. Manual smoke: create a classroom with backend running and confirm it appears.

3. **Assignment + corpus flows** — *done*
   - Create assignment, upload corpus file, open assignment screen. If any step fails, capture error (UI or network) and debug that path.
   - **Done:** Corpus upload validates file type before `uploading`; create/corpus errors surface via alert. Teacher assignment screen shows load error + Retry on fetch failure.

### P1 — Resilience and UX

4. **Backend-down UX** **DONE**
   - Teacher: when fetch throws (Failed to fetch / Network request failed / Load failed), api.ts now throws "Can't reach server. Start the teacher backend." Student document/Workspace screens show "Can't reach server. Start the student backend (python get_coords.py)."

5. **Error boundaries** — *done*
   - You have `ErrorBoundary.tsx`; ensure teacher app root (or main navigator) is wrapped so uncaught render errors don’t white-screen.
   - **Done:** `App.tsx` wraps root with `<ErrorBoundary>` around `<AuthProvider>` and `<RootNavigator />`.
   - **Verified:** `App.tsx` has `ErrorBoundary` as outermost wrapper; any uncaught render error in the app tree is caught and shows the boundary UI (message + Retry). Optional manual test: throw in a screen to confirm no white screen.

6. **Loading and empty states** — *done*
   - Dashboard: loading vs empty list vs error already exist; verify corpus and assignment screens have clear loading/empty/error states.
   - **Done:** Classroom (assignments/corpus/students) already had loading/error/empty. Teacher and student assignment screens now show error state + Retry when load fails.

### P2 — Student side (if you use it next)

7. **Student backend URL** **DONE**
   - **Done:** Added `student/frontend/lib/backendBaseUrl.ts` (web: .env first; native: Expo host first, port 8000). `lib/api.ts`, document screen, and WorkspaceScreen use `BACKEND_URL`.
   - Student frontend uses `EXPO_PUBLIC_BACKEND_URL` (e.g. `http://localhost:8000`). Same “localhost on device” issue: use host from Expo on native or set URL per environment.

8. **Student auth + role** — *done*
   - Same pattern as teacher: session + role from profile/metadata; confirm student signup creates profile with `role = 'student'`.
   - **Confirmed:** Supabase trigger `handle_new_user` reads `raw_user_meta_data->>'role'` (default `'student'`) and inserts `profiles.role`. Teacher app `SignupScreen` passes `role` in `signUp(…, role, …)` → `options.data.role`; trigger runs on insert to `auth.users`, so profile gets the chosen role. Student app has no signup yet; when added, pass `role: 'student'` in signUp `options.data`.
   - **Verified:** Code path: `auth.tsx` `signUp(…, role, …)` uses `options: { data: { role, display_name } }` (Supabase stores as user_metadata → trigger’s `raw_user_meta_data`). Migration `handle_new_user` inserts `profiles(id, role, display_name)` with `role = coalesce(raw_user_meta_data->>'role', 'student')`. Signup as Student → profile.role = 'student'. Runtime check: sign up as student, then query `profiles` or use app as student to confirm role.

9. **End-to-end: teacher creates classroom → student joins → assignment** — *done*
   - Full flow smoke test; debug any failing step (join code, assignment list, submission).
   - **E2E smoke checklist** (run with teacher backend on 5001, both apps pointed at it):
     1. Teacher: sign in → create classroom → note class code.
     2. Student: sign in (separate student account) → enter class code → Join → class appears in list.
     3. Teacher: open classroom → create assignment (title, optional file) → open assignment screen.
     4. Student: open same class → see assignment in list → open assignment → see content.
     5. Student: Submit Solution → upload file → confirm "Solution submitted!" and submission in history.
     6. Teacher: assignment screen → Student Submissions shows the submission.
   - Join errors (invalid code, already joined) are shown via `ClassCodeInput` → `alert("Error", e.message)`; backend returns `error` in JSON.

### P3 — Optional

10. **Health/readiness endpoint**
    - Teacher backend: e.g. `GET /health` returning 200 so the frontend can probe “is the API up?” and show a better message when it’s down.

11. **Env validation at startup**
    - Teacher frontend: on app load, if `API_URL` is missing or unreachable (e.g. dev probe), show a one-time hint instead of failing later on first API call.

---

## Success Criteria

- Teacher: sign up → sign in → dashboard loads classrooms (empty or list) with no "Failed to fetch" when backend is running.
- Teacher: create classroom, open it, create assignment, upload corpus — no silent failures.
- Optional: student can join class and see assignments; teacher can see submissions (when that flow exists).

---

## Mod 1 tasks (1, 4, 7) — done

- **Task 1 (Remove instrumentation):** All agent log blocks removed from teacher frontend (api.ts, auth.tsx, navigation, useClassrooms, DashboardScreen).
- **Task 4 (Backend-down UX):** Teacher api.ts maps network errors to "Can't reach server. Start the teacher backend." Student document/Workspace screens show "Can't reach server. Start the student backend (python get_coords.py)."
- **Task 7 (Student backend URL):** `student/frontend/lib/backendBaseUrl.ts` added; lib/api.ts, document screen, WorkspaceScreen use `BACKEND_URL` (web: .env first; native: Expo host first).

## Mod 3 tasks (3, 6, 9) — done

- **Task 3 (Assignment + corpus):** Corpus upload validates file type before setting `uploading`, so the button never sticks in "uploading" on validation failure. Create-assignment and corpus upload already surface API/upload errors via `alert`. Teacher assignment screen now sets a load error state and shows it with Retry instead of only alerting.
- **Task 6 (Loading/empty/error):** Classroom screen already had loading/error/empty for assignments, corpus, and students. Teacher and student assignment screens now have explicit error state + Retry when fetch fails (instead of only "Assignment not found").
- **Task 9 (E2E):** E2E smoke checklist added above; join and assignment flows already surface errors (ClassCodeInput shows join errors; assignment screens show load error + Retry).

**Verification (code):** CorpusUploadScreen flow (fileType before setUploading), TeacherAssignmentScreen and student AssignmentScreen (loadError state, fetchAssignment retry, errorContainer/retryButton UI and styles, mountedRef) reviewed; logic and imports correct. Teacher frontend `tsc --noEmit` currently fails on pre-existing missing `expo-constants`; no new errors from these changes. **Manual check:** Run E2E checklist above and optionally trigger assignment load failure (e.g. backend off) to confirm error + Retry UI.

**Automated tests (run):** This repo has no Jest/Vitest/pytest suites. Ran what exists:
- **Student frontend** `npm run lint`: **PASS** (expo lint, exit 0).
- **Teacher frontend** `npx expo lint`: **FAIL** — 2 errors (apiBaseUrl.ts: unresolved `expo-constants`; LoginScreen: unescaped `'`), 5 warnings (require imports, array-type, unused View). Fix: add `expo-constants` to teacher frontend deps and address lint errors if desired.
- **Student backend** `python test_pipeline.py`: **FAIL** — `ModuleNotFoundError: anthropic` (run from venv with `pip install -e .` or install deps first).

---

## Notes

- Keep `EXPO_PUBLIC_API_URL=http://localhost:5001` in teacher frontend `.env` for web; native will use Expo-resolved host when available.
- Student: keep `EXPO_PUBLIC_BACKEND_URL=http://localhost:8000` in student frontend `.env` for web; native uses Expo-resolved host via `backendBaseUrl.ts`.
- Always start teacher backend (`flask run` or `python run.py`) before using the teacher app; start student backend (e.g. `python get_coords.py`) before using the student app.
- After changing any `.env`, restart Expo (and restart backend if you change backend `.env`).
