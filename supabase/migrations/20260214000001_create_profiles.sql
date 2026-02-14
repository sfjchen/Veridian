-- Profiles table: synced from auth.users via trigger
create table public.profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    role text not null check (role in ('teacher', 'student')),
    display_name text not null,
    created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Users can read their own profile
create policy "users_read_own_profile" on public.profiles
    for select using (auth.uid() = id);

-- Users can update their own profile
create policy "users_update_own_profile" on public.profiles
    for update using (auth.uid() = id);

-- NOTE: Cross-table profile policies (teachers_read_classroom_students,
-- students_read_classroom_teachers) are created in a deferred migration
-- after classroom_memberships table exists.

-- Auto-create profile on user signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
    insert into public.profiles (id, role, display_name)
    values (
        new.id,
        case
            when coalesce(new.raw_user_meta_data->>'role', 'student') in ('teacher', 'student')
            then new.raw_user_meta_data->>'role'
            else 'student'
        end,
        coalesce(nullif(trim(new.raw_user_meta_data->>'display_name'), ''), 'Unnamed User')
    );
    return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function public.handle_new_user();
