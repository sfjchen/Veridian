-- Indexes for live monitoring tables (assignment_error_logs, assignment_progress_events).
-- These tables are created by the teacher backend at runtime; this migration adds
-- indexes for the most common query patterns if the tables already exist.

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'assignment_error_logs') THEN
        EXECUTE 'CREATE INDEX IF NOT EXISTS idx_error_logs_assignment ON public.assignment_error_logs (assignment_id)';
        EXECUTE 'CREATE INDEX IF NOT EXISTS idx_error_logs_student ON public.assignment_error_logs (student_id)';
        EXECUTE 'CREATE INDEX IF NOT EXISTS idx_error_logs_assignment_occurred ON public.assignment_error_logs (assignment_id, occurred_at DESC)';
    END IF;

    IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'assignment_progress_events') THEN
        EXECUTE 'CREATE INDEX IF NOT EXISTS idx_progress_events_assignment ON public.assignment_progress_events (assignment_id)';
        EXECUTE 'CREATE INDEX IF NOT EXISTS idx_progress_events_student ON public.assignment_progress_events (student_id)';
        EXECUTE 'CREATE INDEX IF NOT EXISTS idx_progress_events_assignment_active ON public.assignment_progress_events (assignment_id, last_active_at DESC)';
    END IF;
END $$;
