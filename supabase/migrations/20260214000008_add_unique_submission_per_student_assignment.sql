-- Ensure one submission record per (assignment, student).
-- Prefer rows with actual uploaded storage objects, then oldest timestamp.
with ranked_submissions as (
    select
        s.id,
        row_number() over (
            partition by s.assignment_id, s.student_id
            order by
                case when so.id is null then 0 else 1 end desc,
                s.submitted_at asc,
                s.id asc
        ) as row_num
    from public.submissions s
    left join storage.objects so
        on so.bucket_id = 'submissions'
        and so.name = s.storage_path
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
