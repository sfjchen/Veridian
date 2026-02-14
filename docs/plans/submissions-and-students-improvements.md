# Submissions And Classroom Visibility Improvements

## What will be built and why

This change addresses concrete functional gaps discovered during trace-through:

1. Prevent unauthorized or confusing submissions access behavior.
2. Prevent duplicate submissions for the same assignment/student pair.
3. Give teachers visibility into classroom student rosters.
4. Give teachers and students visibility into submission artifacts and history.

These directly improve core assignment workflow reliability and make the current platform usable for submission review without changing architecture.

## Files to modify

- `backend/app/routes/assignments.py`
- `backend/app/routes/classrooms.py`
- `frontend/src/types/index.ts`
- `frontend/src/screens/teacher/ClassroomScreen.tsx`
- `frontend/src/screens/teacher/AssignmentScreen.tsx`
- `frontend/src/screens/student/AssignmentScreen.tsx`
- `frontend/src/hooks/useSubmissions.ts` (if needed for payload compatibility)
- `frontend/src/hooks/useClassroomStudents.ts` (new)
- `supabase/migrations/20260214000008_add_unique_submission_per_student_assignment.sql` (new)
- `supabase/all_migrations.sql`

## PR-sized breakdown

1. Backend bug fixes
- enforce `403` on submissions listing for non-members/non-teachers
- pre-check and guard duplicate submission creation
- add DB uniqueness protection migration

2. Backend feature support
- teacher-only classroom students endpoint
- enrich submissions payload with signed `download_url` and teacher-facing student display names

3. Frontend feature integration
- teacher classroom students tab with real data
- teacher assignment screen submissions review section
- student assignment submission history section

## Success criteria

- Non-member querying assignment submissions gets `403`, not an empty success response.
- Student cannot create multiple submission records for one assignment.
- Teacher can load classroom students tab and see joined students.
- Teacher assignment view shows submissions with downloadable files.
- Student assignment view shows prior submissions and prevents duplicate submit creation.

## Open questions

- Whether resubmissions should be allowed in the future (would require replacing current uniqueness model with versioning).
- Whether submission metadata should include grading status; out of scope for this patch.
