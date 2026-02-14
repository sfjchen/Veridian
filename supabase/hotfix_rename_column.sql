-- Run this in Supabase SQL Editor to rename the column from the original migration
-- The code now uses assignment_file_storage_path but the live DB may still have prompt_storage_path

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'assignments'
        AND column_name = 'prompt_storage_path'
    ) THEN
        ALTER TABLE public.assignments RENAME COLUMN prompt_storage_path TO assignment_file_storage_path;
        RAISE NOTICE 'Column renamed: prompt_storage_path -> assignment_file_storage_path';
    ELSE
        RAISE NOTICE 'Column already named assignment_file_storage_path, no change needed';
    END IF;
END $$;
