-- problem_results and chat_messages for teacher schema (assignments.classroom_id).
-- Run after teacher migrations. Compatible with assignments from teacher backend.

create table if not exists public.problem_results (
    id uuid primary key default gen_random_uuid(),
    student_id uuid not null references auth.users(id) on delete cascade,
    assignment_id uuid not null references public.assignments(id) on delete cascade,
    problem_num integer not null,
    student_tex text,
    annotated_tex text,
    continuation_tex text,
    mistake_count integer not null default 0,
    mistakes jsonb not null default '[]'::jsonb,
    status text not null default 'pending'
        check (status in ('pending', 'analyzing', 'complete', 'error')),
    error_message text,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now())
);

do $$
begin
    if not exists (
        select 1 from pg_constraint
        where conname = 'uq_problem_results_student_problem'
        and conrelid = 'public.problem_results'::regclass
    ) then
        alter table public.problem_results
            add constraint uq_problem_results_student_problem
            unique (student_id, assignment_id, problem_num);
    end if;
end $$;

create index if not exists idx_problem_results_student_assignment
    on public.problem_results (student_id, assignment_id);
create index if not exists idx_problem_results_assignment_problem
    on public.problem_results (assignment_id, problem_num);

alter table public.problem_results enable row level security;

drop policy if exists "problem_results_student_select" on public.problem_results;
create policy "problem_results_student_select" on public.problem_results
    for select to authenticated using (student_id = auth.uid());

drop policy if exists "problem_results_student_insert" on public.problem_results;
create policy "problem_results_student_insert" on public.problem_results
    for insert to authenticated with check (student_id = auth.uid());

drop policy if exists "problem_results_student_update" on public.problem_results;
create policy "problem_results_student_update" on public.problem_results
    for update to authenticated
    using (student_id = auth.uid()) with check (student_id = auth.uid());

drop policy if exists "problem_results_teacher_select" on public.problem_results;
create policy "problem_results_teacher_select" on public.problem_results
    for select to authenticated
    using (
        exists (
            select 1 from public.assignments a
            join public.classrooms c on c.id = a.classroom_id
            where a.id = assignment_id and c.teacher_id = auth.uid()
        )
    );

create table if not exists public.chat_messages (
    id uuid primary key default gen_random_uuid(),
    student_id uuid not null references auth.users(id) on delete cascade,
    assignment_id uuid not null references public.assignments(id) on delete cascade,
    problem_num integer not null,
    role text not null check (role in ('student', 'assistant')),
    content text not null,
    created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_chat_messages_conversation
    on public.chat_messages (student_id, assignment_id, problem_num, created_at);
create index if not exists idx_chat_messages_assignment_id
    on public.chat_messages (assignment_id);

alter table public.chat_messages enable row level security;

drop policy if exists "chat_messages_student_select" on public.chat_messages;
create policy "chat_messages_student_select" on public.chat_messages
    for select to authenticated using (student_id = auth.uid());

drop policy if exists "chat_messages_student_insert" on public.chat_messages;
create policy "chat_messages_student_insert" on public.chat_messages
    for insert to authenticated with check (student_id = auth.uid());
