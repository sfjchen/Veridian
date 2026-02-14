-- Storage buckets for file uploads
insert into storage.buckets (id, name, public)
values
    ('corpus', 'corpus', false),
    ('assignments', 'assignments', false),
    ('submissions', 'submissions', false);

-- Corpus bucket: teachers upload, students in classroom can read
create policy "teachers_upload_corpus" on storage.objects
    for insert with check (
        bucket_id = 'corpus'
        and exists (
            select 1 from public.classrooms
            where teacher_id = auth.uid()
            and id::text = (storage.foldername(name))[1]
        )
    );

create policy "teachers_read_corpus" on storage.objects
    for select using (
        bucket_id = 'corpus'
        and exists (
            select 1 from public.classrooms
            where teacher_id = auth.uid()
            and id::text = (storage.foldername(name))[1]
        )
    );

create policy "students_read_corpus" on storage.objects
    for select using (
        bucket_id = 'corpus'
        and exists (
            select 1 from public.classroom_memberships
            where student_id = auth.uid()
            and classroom_id::text = (storage.foldername(name))[1]
        )
    );

-- Assignments bucket: teachers upload, students in classroom can read
create policy "teachers_upload_assignments" on storage.objects
    for insert with check (
        bucket_id = 'assignments'
        and exists (
            select 1 from public.classrooms
            where teacher_id = auth.uid()
            and id::text = (storage.foldername(name))[1]
        )
    );

create policy "teachers_read_assignments" on storage.objects
    for select using (
        bucket_id = 'assignments'
        and exists (
            select 1 from public.classrooms
            where teacher_id = auth.uid()
            and id::text = (storage.foldername(name))[1]
        )
    );

create policy "students_read_assignments" on storage.objects
    for select using (
        bucket_id = 'assignments'
        and exists (
            select 1 from public.classroom_memberships
            where student_id = auth.uid()
            and classroom_id::text = (storage.foldername(name))[1]
        )
    );

-- Submissions bucket: students upload own, teachers of classroom can read
create policy "students_upload_submissions" on storage.objects
    for insert with check (
        bucket_id = 'submissions'
        and auth.uid()::text = (storage.foldername(name))[2]
    );

create policy "students_read_own_submissions" on storage.objects
    for select using (
        bucket_id = 'submissions'
        and auth.uid()::text = (storage.foldername(name))[2]
    );

create policy "teachers_read_submissions" on storage.objects
    for select using (
        bucket_id = 'submissions'
        and exists (
            select 1 from public.classrooms
            where teacher_id = auth.uid()
            and id::text = (storage.foldername(name))[1]
        )
    );
