-- Make storage_path nullable to support simple submission marking
alter table public.submissions
    alter column storage_path drop not null;
