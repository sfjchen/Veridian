-- Per-problem assignment model.
-- Teacher backend creates assignments; student backend reads them and writes results.

create table if not exists public.assignments (
    id uuid primary key default gen_random_uuid(),
    teacher_id uuid not null references auth.users(id) on delete cascade,
    title text not null,
    problems jsonb not null default '[]'::jsonb
        check (jsonb_typeof(problems) = 'array'),
    answer_key_storage_path text,
    context_file_ids uuid[] default '{}',
    hint_level text not null default 'guided'
        check (hint_level in ('minimal', 'guided', 'detailed')),
    reveal_mode text not null default 'single-tap'
        check (reveal_mode in ('single-tap', 'progressive')),
    auto_analyze boolean not null default true,
    analysis_debounce_seconds integer not null default 15,
    notification_level text not null default 'nudge'
        check (notification_level in ('passive', 'nudge', 'interrupt')),
    chat_enabled boolean not null default false,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_assignments_teacher_created
    on public.assignments (teacher_id, created_at desc);

alter table public.assignments enable row level security;

-- Teachers can manage their own assignments.
drop policy if exists "assignments_teacher_all" on public.assignments;
create policy "assignments_teacher_all"
    on public.assignments
    for all
    to authenticated
    using (teacher_id = auth.uid())
    with check (teacher_id = auth.uid());

-- Students can read any assignment (enrolled access gated at app layer).
drop policy if exists "assignments_student_select" on public.assignments;
create policy "assignments_student_select"
    on public.assignments
    for select
    to authenticated
    using (true);


-- Per-problem analysis results.
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

-- One result per student per problem.
alter table public.problem_results
    add constraint uq_problem_results_student_problem
    unique (student_id, assignment_id, problem_num);

create index if not exists idx_problem_results_student_assignment
    on public.problem_results (student_id, assignment_id);

create index if not exists idx_problem_results_assignment_problem
    on public.problem_results (assignment_id, problem_num);

alter table public.problem_results enable row level security;

-- Students can read and write their own results.
drop policy if exists "problem_results_student_select" on public.problem_results;
create policy "problem_results_student_select"
    on public.problem_results
    for select
    to authenticated
    using (student_id = auth.uid());

drop policy if exists "problem_results_student_insert" on public.problem_results;
create policy "problem_results_student_insert"
    on public.problem_results
    for insert
    to authenticated
    with check (student_id = auth.uid());

drop policy if exists "problem_results_student_update" on public.problem_results;
create policy "problem_results_student_update"
    on public.problem_results
    for update
    to authenticated
    using (student_id = auth.uid())
    with check (student_id = auth.uid());

-- Teachers can read results for their assignments.
drop policy if exists "problem_results_teacher_select" on public.problem_results;
create policy "problem_results_teacher_select"
    on public.problem_results
    for select
    to authenticated
    using (
        exists (
            select 1 from public.assignments a
            where a.id = assignment_id and a.teacher_id = auth.uid()
        )
    );
