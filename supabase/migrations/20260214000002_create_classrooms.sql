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

-- Teachers see own classrooms
create policy "teachers_manage_own_classrooms" on public.classrooms
    for all using (auth.uid() = teacher_id);

-- Students see classrooms they've joined
create policy "students_read_joined_classrooms" on public.classrooms
    for select using (
        exists (
            select 1 from public.classroom_memberships
            where classroom_id = classrooms.id
            and student_id = auth.uid()
        )
    );
