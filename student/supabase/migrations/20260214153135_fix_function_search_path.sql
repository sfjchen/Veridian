-- Fix function search_path (security advisor) - prevent search_path injection.
-- Guard alters: veridian_set_updated_at and handle_new_user may not exist in fresh DBs.
do $$
begin
  if exists (select 1 from pg_proc p join pg_namespace n on p.pronamespace = n.oid where n.nspname = 'public' and p.proname = 'veridian_set_updated_at') then
    alter function public.veridian_set_updated_at() set search_path = public;
  end if;
  if exists (select 1 from pg_proc p join pg_namespace n on p.pronamespace = n.oid where n.nspname = 'public' and p.proname = 'handle_new_user') then
    alter function public.handle_new_user() set search_path = public;
  end if;
  if exists (select 1 from pg_proc p join pg_namespace n on p.pronamespace = n.oid where n.nspname = 'public' and p.proname = 'veridian_sample_worksheets_set_updated_at') then
    alter function public.veridian_sample_worksheets_set_updated_at() set search_path = public;
  end if;
end $$;
