-- ============================================================================
-- MIGRATION 001: Create Profiles Table
-- ============================================================================

create table public.profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    role text not null check (role in ('teacher', 'student')),
    display_name text not null,
    created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Users can read their own profile
create policy "users_read_own_profile" on public.profiles
    for select using (auth.uid() = id);

-- Users can update their own profile
create policy "users_update_own_profile" on public.profiles
    for update using (auth.uid() = id);

-- Auto-create profile on user signup
create or replace function public.handle_new_user()
returns trigger as $$
declare
    user_role text;
begin
    user_role := coalesce(new.raw_user_meta_data->>'role', 'student');
    if user_role not in ('teacher', 'student') then
        user_role := 'student';
    end if;

    insert into public.profiles (id, role, display_name)
    values (
        new.id,
        user_role,
        coalesce(nullif(trim(new.raw_user_meta_data->>'display_name'), ''), 'Unnamed User')
    );
    return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function public.handle_new_user();


-- ============================================================================
-- MIGRATION 002: Create Classrooms Table
-- ============================================================================

create table public.classrooms (
    id uuid primary key default gen_random_uuid(),
    teacher_id uuid not null references public.profiles(id) on delete cascade,
    name text not null,
    class_code text unique not null,
    created_at timestamptz not null default now()
);

create index idx_classrooms_teacher on public.classrooms(teacher_id);
create index idx_classrooms_code on public.classrooms(class_code);

alter table public.classrooms enable row level security;

-- Teachers manage own classrooms (split by operation to avoid RLS recursion)
create policy "teachers_select_own_classrooms" on public.classrooms
    for select using (auth.uid() = teacher_id);

create policy "teachers_insert_own_classrooms" on public.classrooms
    for insert with check (
        auth.uid() = teacher_id
        and exists (
            select 1 from public.profiles
            where id = auth.uid() and role = 'teacher'
        )
    );

create policy "teachers_update_own_classrooms" on public.classrooms
    for update using (auth.uid() = teacher_id);

create policy "teachers_delete_own_classrooms" on public.classrooms
    for delete using (auth.uid() = teacher_id);


-- ============================================================================
-- MIGRATION 003: Create Classroom Memberships Table
-- ============================================================================

create table public.classroom_memberships (
    student_id uuid not null references public.profiles(id) on delete cascade,
    classroom_id uuid not null references public.classrooms(id) on delete cascade,
    joined_at timestamptz not null default now(),
    primary key (student_id, classroom_id)
);

create index idx_memberships_classroom on public.classroom_memberships(classroom_id);

alter table public.classroom_memberships enable row level security;

-- Students can see their own memberships
create policy "students_read_own_memberships" on public.classroom_memberships
    for select using (auth.uid() = student_id);

-- Students can insert their own memberships (joining a classroom)
create policy "students_join_classrooms" on public.classroom_memberships
    for insert with check (auth.uid() = student_id);

-- Teachers can see memberships in their classrooms
create policy "teachers_read_classroom_memberships" on public.classroom_memberships
    for select using (
        exists (
            select 1 from public.classrooms
            where id = classroom_memberships.classroom_id
            and teacher_id = auth.uid()
        )
    );

-- Students can leave classrooms
create policy "students_leave_classrooms" on public.classroom_memberships
    for delete using (auth.uid() = student_id);

-- Teachers can remove students from their classrooms
create policy "teachers_remove_students" on public.classroom_memberships
    for delete using (
        exists (
            select 1 from public.classrooms
            where id = classroom_memberships.classroom_id
            and teacher_id = auth.uid()
        )
    );


-- ============================================================================
-- DEFERRED POLICIES: Profiles and Classrooms (depend on classroom_memberships)
-- ============================================================================

-- Teachers can read student profiles in their classrooms
create policy "teachers_read_classroom_students" on public.profiles
    for select using (
        exists (
            select 1 from public.classroom_memberships cm
            join public.classrooms c on c.id = cm.classroom_id
            where cm.student_id = profiles.id
            and c.teacher_id = auth.uid()
        )
    );

-- Students can read teacher profiles of joined classrooms
create policy "students_read_classroom_teachers" on public.profiles
    for select using (
        exists (
            select 1 from public.classrooms c
            join public.classroom_memberships cm on cm.classroom_id = c.id
            where c.teacher_id = profiles.id
            and cm.student_id = auth.uid()
        )
    );

-- Students see classrooms they've joined (security definer to avoid RLS recursion)
create or replace function public.get_student_classroom_ids(student_uuid uuid)
returns setof uuid
language sql
security definer
set search_path = public
stable
as $$
    select classroom_id from classroom_memberships where student_id = student_uuid;
$$;

create policy "students_read_joined_classrooms" on public.classrooms
    for select using (
        id in (select public.get_student_classroom_ids(auth.uid()))
    );


-- ============================================================================
-- MIGRATION 004: Create Corpus Files Table
-- ============================================================================

create table public.corpus_files (
    id uuid primary key default gen_random_uuid(),
    classroom_id uuid not null references public.classrooms(id) on delete cascade,
    display_name text not null,
    storage_path text not null,
    file_type text not null,
    uploaded_at timestamptz not null default now()
);

create index idx_corpus_classroom on public.corpus_files(classroom_id);

alter table public.corpus_files enable row level security;

-- Teachers manage corpus files in their classrooms
create policy "teachers_manage_corpus" on public.corpus_files
    for all using (
        exists (
            select 1 from public.classrooms
            where id = corpus_files.classroom_id
            and teacher_id = auth.uid()
        )
    );

-- Students read corpus files in joined classrooms
create policy "students_read_corpus" on public.corpus_files
    for select using (
        exists (
            select 1 from public.classroom_memberships
            where classroom_id = corpus_files.classroom_id
            and student_id = auth.uid()
        )
    );


-- ============================================================================
-- MIGRATION 005: Create Assignments Table
-- ============================================================================

create table public.assignments (
    id uuid primary key default gen_random_uuid(),
    classroom_id uuid not null references public.classrooms(id) on delete cascade,
    title text not null,
    prompt_storage_path text,
    answer_key_storage_path text,
    context_file_ids uuid[] default '{}',
    due_date timestamptz,
    created_at timestamptz not null default now()
);

create index idx_assignments_classroom on public.assignments(classroom_id);

alter table public.assignments enable row level security;

-- Teachers manage assignments in their classrooms
create policy "teachers_manage_assignments" on public.assignments
    for all using (
        exists (
            select 1 from public.classrooms
            where id = assignments.classroom_id
            and teacher_id = auth.uid()
        )
    );

-- Students read assignments in joined classrooms
create policy "students_read_assignments" on public.assignments
    for select using (
        exists (
            select 1 from public.classroom_memberships
            where classroom_id = assignments.classroom_id
            and student_id = auth.uid()
        )
    );


-- ============================================================================
-- MIGRATION 006: Create Submissions Table
-- ============================================================================

create table public.submissions (
    id uuid primary key default gen_random_uuid(),
    assignment_id uuid not null references public.assignments(id) on delete cascade,
    student_id uuid not null references public.profiles(id) on delete cascade,
    storage_path text not null,
    submitted_at timestamptz not null default now()
);

create index idx_submissions_assignment on public.submissions(assignment_id);
create index idx_submissions_student on public.submissions(student_id);

alter table public.submissions enable row level security;

-- Students manage own submissions
create policy "students_manage_own_submissions" on public.submissions
    for all using (auth.uid() = student_id);

-- Teachers read submissions in their classrooms
create policy "teachers_read_submissions" on public.submissions
    for select using (
        exists (
            select 1 from public.assignments a
            join public.classrooms c on c.id = a.classroom_id
            where a.id = submissions.assignment_id
            and c.teacher_id = auth.uid()
        )
    );


-- ============================================================================
-- MIGRATION 007: Create Storage Buckets
-- ============================================================================

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
        and exists (
            select 1 from public.classroom_memberships
            where student_id = auth.uid()
            and classroom_id::text = (storage.foldername(name))[1]
        )
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
