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
