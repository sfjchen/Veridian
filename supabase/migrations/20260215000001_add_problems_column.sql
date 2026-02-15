-- Add problems JSONB column and prompt_latex text column to assignments table.
-- problems: Each problem is an object with { num: int, statement_tex: text }.
-- prompt_latex: Persisted PDF-to-LaTeX conversion results.

alter table public.assignments
    add column if not exists problems jsonb default '[]'::jsonb;

alter table public.assignments
    add column if not exists prompt_latex text;
