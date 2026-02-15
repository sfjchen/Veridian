-- Add solutions and answer_key_latex columns to assignments table
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS solutions jsonb DEFAULT '[]';
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS answer_key_latex text;
