# Polish for a Demoable Product — Plan

**Goal:** Make the platform feel polished and demo-ready — consistent UI, clear feedback, no rough edges. Scope: teacher and student frontends (and minimal backend touchpoints only where they affect the demo). **Not** focused on production hardening (CORS, rate limits, runbooks, etc.); those stay in separate plans.

**Current state:** Core flows work; some screens still use raw styles, and error/success feedback is mixed (alerts vs toasts vs in-screen state). Demo should look and feel cohesive.

---

## P0 — Demo-Ready UX

**1. UI consistency with design system**

- [CreateAssignmentScreen](teacher/frontend/src/screens/teacher/CreateAssignmentScreen.tsx) uses raw colors and ad-hoc styles (`#fff`, `#4F46E5`, `#374151`, raw font sizes). Migrate to Veridian tokens and primitives: `palette`, `typography`, `spacing`, ScreenContainer, Card, Input, Button, Section — so it matches the rest of the teacher app.
- Quick audit: any other teacher or student screens with hardcoded colors or non-token typography; fix in the same pass or a short follow-up.

**2. Error and success feedback**

- Prefer in-screen error state or toast over blocking `alert()` where it makes the demo smoother (e.g. "Saved" or "Upload complete" as toast; form errors inline or in an error bar).
- Keep `alert()` only for real blocking cases (e.g. "Sign up failed", "Invalid class code"). Replace generic `alert("Error", message)` with ErrorState + Retry or toast where the screen has room and it improves the flow.
- Scope: low-effort, high-impact spots (success toasts, non-blocking errors). No full modal replacement.

**3. Student frontend: backend-unreachable hint**

- If the student app can’t reach the backend (missing URL or health probe fails), show a one-time dismissible hint like the teacher frontend’s ApiUrlHint — so demos don’t fail silently with "Failed to fetch" on first action. Mirror the teacher pattern: [student/frontend/lib/backendBaseUrl.ts](student/frontend/lib/backendBaseUrl.ts) + a small hint component, optional dev-only health probe.

**4. No white screens or dead ends**

- Spot-check critical demo paths: auth, create classroom/assignment, upload corpus, student join class and open assignment, submit solution. Ensure every API failure path shows error state or Retry (no uncaught exceptions or blank screens). ErrorBoundary and per-screen error states already exist; confirm they’re wired for these flows.

---

## P1 — Nice-to-Have for Demo

**5. Loading and empty states**

- Confirm key lists (classrooms, assignments, corpus, submissions) show clear loading and empty states so the demo doesn’t show a blank list without explanation. Most already exist; fill any gaps.

**6. One-page demo script**

- Short bullet list in README or in this plan: "Demo flow" (e.g. teacher sign in → create classroom → create assignment with file → student sign in → join with code → open assignment → submit; optional: show teacher submissions). Makes it easy to run a consistent demo.

---

## Deferred (Not for Demo Polish)

- **CORS, rate limiting, runbooks:** See [production-chat-rate-limiting.md](production-chat-rate-limiting.md) and future production plans. Out of scope for demo polish.
- **Request IDs, structured logging, deep health:** Production observability; skip for demo.
- **.env.example audit, production env docs:** Do when targeting real production.

---

## Success Criteria

- CreateAssignmentScreen (and any other off-token screens) use Veridian tokens and primitives; app looks consistent.
- Success and non-blocking errors use toast or in-screen state where it improves the demo; blocking errors still use alert where appropriate.
- Student frontend shows a one-time hint when backend is missing/unreachable so the demo doesn’t fail silently.
- Critical demo paths never white-screen; errors show Retry or a clear message.
- Optional: one-page demo script so anyone can run a repeatable demo.

---

## Files to Touch (Summary)

- **Teacher frontend:** CreateAssignmentScreen.tsx (tokens + primitives), selected alert→toast/error-state in a few high-traffic screens.
- **Student frontend:** backendBaseUrl.ts + small ApiUrlHint-style component; optional health probe.
- **Docs:** Optional "Demo flow" subsection in README or at top of this plan.

---

## Order of Work

1. CreateAssignmentScreen design-system alignment + quick audit of other screens.
2. Student frontend backend-URL hint (mirror teacher ApiUrlHint).
3. Selective error/success UX (toasts, in-screen errors) where quick and visible in the demo.
4. Spot-check demo paths for white screens and missing error/Retry.
5. Optional: write down the one-page demo script.

Update this plan as items are completed. Integrate into PLAN.md when the demo polish work is merged.
