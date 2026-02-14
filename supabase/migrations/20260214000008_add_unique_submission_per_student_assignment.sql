-- Ensure one submission record per (assignment, student).
-- Keep the most recent row if duplicates already exist.
with ranked_submissions as (
    select
        id,
        row_number() over (
            partition by assignment_id, student_id
            order by submitted_at desc, id desc
        ) as row_num
    from public.submissions
)
delete from public.submissions
where id in (
    select id
    from ranked_submissions
    where row_num > 1
);

do $$
begin
    if not exists (
        select 1
        from pg_constraint
        where conname = 'submissions_assignment_student_unique'
        and conrelid = 'public.submissions'::regclass
    ) then
        alter table public.submissions
            add constraint submissions_assignment_student_unique unique (assignment_id, student_id);
    end if;
end
$$;
