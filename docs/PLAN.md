# Project Plan — Math Mistake Analysis Platform

## Overview

EdTech platform where teachers create math assignments, students submit solutions, and AI analyzes mistake patterns using corpus materials. Built with Flask + Expo React Native + Supabase.

---

## Completed Work

### PR #1–9 (Previous session)
- [x] Supabase schema: profiles, classrooms, memberships, corpus_files, assignments, submissions
- [x] RLS policies for all tables + storage buckets
- [x] Flask backend with JWT auth middleware
- [x] Teacher dashboard: create/list classrooms
- [x] Student dashboard: join/list classrooms
- [x] Corpus file upload (teacher)
- [x] Assignment creation with file upload
- [x] Submission creation with file upload
- [x] Signed URL generation (upload + download) via admin client
- [x] Auth flow: signup, login, role-based navigation
- [x] PDF-to-LaTeX conversion endpoint (Claude API)

### PR #10 — Column name revert
- [x] Reverted `assignment_file_storage_path` → `prompt_storage_path` to match live DB
- [x] Root cause: code was renamed but live DB migration was never run

### PR #11 — Admin client + corpus UX (in review)
- [x] Switched all backend routes to admin client (bypasses RLS join issues)
- [x] Removed PostgREST resource embedding in favor of separate queries
- [x] Reworked corpus upload to single-step flow (pick file → create + upload)
- [x] Added README.md with setup instructions
- [x] Addressed all @claude review feedback (P0/P1/P2)

---

## Remaining Work

### P0 — Core functionality gaps
- [ ] **Student submission flow**: Students can create/view submissions, but grading workflow is still missing
- [ ] **AI mistake analysis**: Core value prop — analyze student submissions against answer key + corpus
- [ ] **End-to-end testing**: Verify full flow works (create assignment → student submits → teacher reviews)

### P1 — Teacher experience
- [x] **Student list in classroom**: "Students" tab shows real roster data
- [ ] **Submission review screen**: Teacher can view/download submissions, AI analysis still missing
- [ ] **Bulk operations**: Delete assignments, remove students from classroom

### P2 — Student experience
- [x] **Assignment list in classroom**: Students see assignments and can submit solutions
- [x] **Submission history**: Student sees past submissions and can reopen uploaded files
- [ ] **Due date warnings**: Visual indicators for approaching/past due dates

### P3 — Polish
- [ ] **Loading states**: Consistent loading indicators across all screens
- [ ] **Error boundaries**: Graceful error handling in React components
- [ ] **Responsive design**: Better layout for web vs mobile
- [ ] **Pagination**: For large classrooms with many assignments/submissions

---

## Architecture Decisions

| Decision | Rationale |
|----------|-----------|
| Admin client for all DB queries | RLS + PostgREST joins caused silent failures; manual access checks are already in place |
| Single-step file upload UX | Two-step flow (create record → upload) confused users; pick-first-then-create is more intuitive |
| `prompt_storage_path` column name | Live DB uses this name; renaming code is cheaper than migrating production |
| Signed URLs via admin client | User JWTs are rejected by Supabase Storage API; admin client bypasses this |
| Submission uniqueness (`assignment_id`, `student_id`) | Aligns API behavior with product intent: one canonical submission per student per assignment |
| ES256 JWT verification via JWKS | Standard Supabase auth flow, verified against Supabase's JWKS endpoint |
