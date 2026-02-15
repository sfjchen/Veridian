-- Allow storage_path to be null for corpus files (matches assignment pattern)
ALTER TABLE public.corpus_files ALTER COLUMN storage_path DROP NOT NULL;
