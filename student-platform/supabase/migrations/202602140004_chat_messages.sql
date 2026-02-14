-- Per-problem Socratic tutoring chat messages.

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

alter table public.chat_messages enable row level security;

-- Students can read their own chat messages.
drop policy if exists "chat_messages_student_select" on public.chat_messages;
create policy "chat_messages_student_select"
    on public.chat_messages
    for select
    to authenticated
    using (student_id = auth.uid());

-- Students can insert their own chat messages.
drop policy if exists "chat_messages_student_insert" on public.chat_messages;
create policy "chat_messages_student_insert"
    on public.chat_messages
    for insert
    to authenticated
    with check (student_id = auth.uid());
