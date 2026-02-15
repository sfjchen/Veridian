-- Add latex_content column to corpus_files for storing converted PDFs
ALTER TABLE corpus_files
  ADD COLUMN latex_content text;

-- Add published flag to assignments for review workflow
-- Default false means assignments are drafts until explicitly published
ALTER TABLE assignments
  ADD COLUMN published boolean NOT NULL DEFAULT false;

-- Add index for efficient querying of published assignments
CREATE INDEX idx_assignments_published ON assignments(published);

-- Add comment for documentation
COMMENT ON COLUMN corpus_files.latex_content IS 'LaTeX content extracted from PDF files via automated conversion';
COMMENT ON COLUMN assignments.published IS 'Whether assignment is visible to students (true) or draft (false)';
