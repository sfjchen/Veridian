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
