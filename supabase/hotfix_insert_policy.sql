-- HOTFIX: Fix classroom INSERT policy that causes infinite recursion
-- The old policy queries profiles table directly, whose RLS policies
-- query back into classrooms → infinite recursion.
-- Fix: use a SECURITY DEFINER function to bypass profiles RLS.

create or replace function public.get_user_role(user_uuid uuid)
returns text
language sql
security definer
set search_path = public
stable
as $$
    select role from profiles where id = user_uuid;
$$;

drop policy if exists "teachers_insert_own_classrooms" on public.classrooms;

create policy "teachers_insert_own_classrooms" on public.classrooms
    for insert with check (
        auth.uid() = teacher_id
        and public.get_user_role(auth.uid()) = 'teacher'
    );
