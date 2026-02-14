-- Fix RLS recursion + security hardening
-- Run this ONCE in Supabase SQL Editor against the live database.

-- ============================================================================
-- 1. Fix classrooms RLS recursion
-- ============================================================================

drop policy if exists "teachers_manage_own_classrooms" on public.classrooms;
drop policy if exists "students_read_joined_classrooms" on public.classrooms;
drop policy if exists "teachers_select_own_classrooms" on public.classrooms;
drop policy if exists "teachers_insert_own_classrooms" on public.classrooms;
drop policy if exists "teachers_update_own_classrooms" on public.classrooms;
drop policy if exists "teachers_delete_own_classrooms" on public.classrooms;

-- Security definer function to check role without triggering profiles RLS
-- (profiles has cross-table policies that query classrooms, causing recursion)
create or replace function public.get_user_role(user_uuid uuid)
returns text
language sql
security definer
set search_path = public
stable
as $$
    select role from profiles where id = user_uuid;
$$;

create policy "teachers_select_own_classrooms" on public.classrooms
    for select using (auth.uid() = teacher_id);

-- Role check via security definer to avoid RLS recursion through profiles
create policy "teachers_insert_own_classrooms" on public.classrooms
    for insert with check (
        auth.uid() = teacher_id
        and public.get_user_role(auth.uid()) = 'teacher'
    );

create policy "teachers_update_own_classrooms" on public.classrooms
    for update using (auth.uid() = teacher_id);

create policy "teachers_delete_own_classrooms" on public.classrooms
    for delete using (auth.uid() = teacher_id);

-- Security definer function to break RLS recursion for students
create or replace function public.get_student_classroom_ids(student_uuid uuid)
returns setof uuid
language sql
security definer
set search_path = public
stable
as $$
    select classroom_id from classroom_memberships where student_id = student_uuid;
$$;

create policy "students_read_joined_classrooms" on public.classrooms
    for select using (
        id in (select public.get_student_classroom_ids(auth.uid()))
    );


-- ============================================================================
-- 2. Add missing DELETE policies on classroom_memberships
-- ============================================================================

create policy "students_leave_classrooms" on public.classroom_memberships
    for delete using (auth.uid() = student_id);

create policy "teachers_remove_students" on public.classroom_memberships
    for delete using (
        exists (
            select 1 from public.classrooms
            where id = classroom_memberships.classroom_id
            and teacher_id = auth.uid()
        )
    );


-- ============================================================================
-- 3. Harden handle_new_user trigger (validate role, non-empty display name)
-- ============================================================================

create or replace function public.handle_new_user()
returns trigger as $$
declare
    user_role text;
begin
    user_role := coalesce(new.raw_user_meta_data->>'role', 'student');
    if user_role not in ('teacher', 'student') then
        user_role := 'student';
    end if;

    insert into public.profiles (id, role, display_name)
    values (
        new.id,
        user_role,
        coalesce(nullif(trim(new.raw_user_meta_data->>'display_name'), ''), 'Unnamed User')
    );
    return new;
end;
$$ language plpgsql security definer;


-- ============================================================================
-- 4. Harden submissions storage upload (verify classroom membership)
-- ============================================================================

drop policy if exists "students_upload_submissions" on storage.objects;

create policy "students_upload_submissions" on storage.objects
    for insert with check (
        bucket_id = 'submissions'
        and auth.uid()::text = (storage.foldername(name))[2]
        and exists (
            select 1 from public.classroom_memberships
            where student_id = auth.uid()
            and classroom_id::text = (storage.foldername(name))[1]
        )
    );
