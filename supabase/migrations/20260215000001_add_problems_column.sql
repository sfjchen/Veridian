-- Add problems JSONB column to assignments table.
-- Each problem is an object with { num: int, statement_tex: text }.
alter table public.assignments
    add column if not exists problems jsonb default '[]'::jsonb;
