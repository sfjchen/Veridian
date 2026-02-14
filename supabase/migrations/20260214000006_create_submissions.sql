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
