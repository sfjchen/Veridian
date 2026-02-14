-- Artifact and coordinate-run storage for student platform.
-- Safe to run against an existing Supabase project used by other apps.

create extension if not exists pgcrypto;

create table if not exists public.veridian_artifacts (
    id uuid primary key default gen_random_uuid(),
    owner_id uuid not null references auth.users(id) on delete cascade,
    artifact_type text not null check (
        artifact_type in ('latex', 'screenshot', 'prompt', 'answer_key', 'submission', 'context', 'other')
    ),
    display_name text not null,
    mime_type text,
    byte_size bigint check (byte_size is null or byte_size >= 0),
    storage_bucket text not null default 'veridian-artifacts',
    storage_path text not null unique,
    metadata jsonb not null default '{}'::jsonb,
    uploaded_at timestamptz,
    created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.veridian_mistake_coord_runs (
    id uuid primary key default gen_random_uuid(),
    owner_id uuid not null references auth.users(id) on delete cascade,
    screenshot_artifact_id uuid not null references public.veridian_artifacts(id) on delete cascade,
    latex_artifact_id uuid not null references public.veridian_artifacts(id) on delete cascade,
    result jsonb not null,
    created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_veridian_artifacts_owner_created
    on public.veridian_artifacts (owner_id, created_at desc);

create index if not exists idx_veridian_artifacts_owner_type_created
    on public.veridian_artifacts (owner_id, artifact_type, created_at desc);

create index if not exists idx_veridian_coord_runs_owner_created
    on public.veridian_mistake_coord_runs (owner_id, created_at desc);

alter table public.veridian_artifacts enable row level security;
alter table public.veridian_mistake_coord_runs enable row level security;

drop policy if exists "veridian_artifacts_select_own" on public.veridian_artifacts;
create policy "veridian_artifacts_select_own"
    on public.veridian_artifacts
    for select
    to authenticated
    using (owner_id = auth.uid());

drop policy if exists "veridian_artifacts_insert_own" on public.veridian_artifacts;
create policy "veridian_artifacts_insert_own"
    on public.veridian_artifacts
    for insert
    to authenticated
    with check (owner_id = auth.uid());

drop policy if exists "veridian_artifacts_update_own" on public.veridian_artifacts;
create policy "veridian_artifacts_update_own"
    on public.veridian_artifacts
    for update
    to authenticated
    using (owner_id = auth.uid())
    with check (owner_id = auth.uid());

drop policy if exists "veridian_artifacts_delete_own" on public.veridian_artifacts;
create policy "veridian_artifacts_delete_own"
    on public.veridian_artifacts
    for delete
    to authenticated
    using (owner_id = auth.uid());

drop policy if exists "veridian_coord_runs_select_own" on public.veridian_mistake_coord_runs;
create policy "veridian_coord_runs_select_own"
    on public.veridian_mistake_coord_runs
    for select
    to authenticated
    using (owner_id = auth.uid());

drop policy if exists "veridian_coord_runs_insert_own" on public.veridian_mistake_coord_runs;
create policy "veridian_coord_runs_insert_own"
    on public.veridian_mistake_coord_runs
    for insert
    to authenticated
    with check (owner_id = auth.uid());

insert into storage.buckets (id, name, public)
values ('veridian-artifacts', 'veridian-artifacts', false)
on conflict (id) do nothing;

drop policy if exists "veridian_storage_select_own" on storage.objects;
create policy "veridian_storage_select_own"
    on storage.objects
    for select
    to authenticated
    using (
        bucket_id = 'veridian-artifacts'
        and (storage.foldername(name))[1] = auth.uid()::text
    );

drop policy if exists "veridian_storage_insert_own" on storage.objects;
create policy "veridian_storage_insert_own"
    on storage.objects
    for insert
    to authenticated
    with check (
        bucket_id = 'veridian-artifacts'
        and (storage.foldername(name))[1] = auth.uid()::text
    );

drop policy if exists "veridian_storage_update_own" on storage.objects;
create policy "veridian_storage_update_own"
    on storage.objects
    for update
    to authenticated
    using (
        bucket_id = 'veridian-artifacts'
        and (storage.foldername(name))[1] = auth.uid()::text
    )
    with check (
        bucket_id = 'veridian-artifacts'
        and (storage.foldername(name))[1] = auth.uid()::text
    );

drop policy if exists "veridian_storage_delete_own" on storage.objects;
create policy "veridian_storage_delete_own"
    on storage.objects
    for delete
    to authenticated
    using (
        bucket_id = 'veridian-artifacts'
        and (storage.foldername(name))[1] = auth.uid()::text
    );

