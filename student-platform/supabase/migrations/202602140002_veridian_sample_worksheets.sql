create extension if not exists pgcrypto;

create table if not exists public.veridian_sample_worksheets (
    id uuid primary key default gen_random_uuid(),
    slug text not null unique,
    title text not null,
    subject text not null,
    grade_level text not null,
    problem_count integer not null check (problem_count > 0),
    worksheet_text text not null,
    solution_text text not null,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create or replace function public.veridian_sample_worksheets_set_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

drop trigger if exists trg_veridian_sample_worksheets_updated_at on public.veridian_sample_worksheets;
create trigger trg_veridian_sample_worksheets_updated_at
before update on public.veridian_sample_worksheets
for each row execute function public.veridian_sample_worksheets_set_updated_at();

alter table public.veridian_sample_worksheets enable row level security;

drop policy if exists "veridian_sample_worksheets_select" on public.veridian_sample_worksheets;
create policy "veridian_sample_worksheets_select"
    on public.veridian_sample_worksheets
    for select
    to authenticated
    using (true);

-- Write access is intentionally omitted for the authenticated role.
-- Sample worksheets are shared reference data managed via the service_role
-- client (which bypasses RLS), so no authenticated-user write policy is needed.
