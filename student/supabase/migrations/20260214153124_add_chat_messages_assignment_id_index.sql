-- Index for FK chat_messages_assignment_id_fkey (performance advisor)
create index if not exists idx_chat_messages_assignment_id
    on public.chat_messages (assignment_id);
