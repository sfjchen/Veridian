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
