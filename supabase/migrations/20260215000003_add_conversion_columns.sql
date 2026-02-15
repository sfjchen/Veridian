-- Add latex_content column to corpus_files for storing converted PDFs
ALTER TABLE corpus_files
  ADD COLUMN latex_content text;

-- Add published flag to assignments for review workflow
-- Existing assignments stay visible; new assignments default to draft
ALTER TABLE assignments
  ADD COLUMN published boolean NOT NULL DEFAULT true;

ALTER TABLE assignments
  ALTER COLUMN published SET DEFAULT false;

-- Add index for efficient querying of published assignments
CREATE INDEX idx_assignments_published ON assignments(published);

-- Add comment for documentation
COMMENT ON COLUMN corpus_files.latex_content IS 'LaTeX content extracted from PDF files via automated conversion';
COMMENT ON COLUMN assignments.published IS 'Whether assignment is visible to students (true) or draft (false)';

-- Rollback (manual):
-- ALTER TABLE assignments DROP COLUMN published;
-- ALTER TABLE corpus_files DROP COLUMN latex_content;
-- DROP INDEX IF EXISTS idx_assignments_published;
