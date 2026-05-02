-- Drop 'program' and 'level' columns from the students table
ALTER TABLE public.students
  DROP COLUMN IF EXISTS program,
  DROP COLUMN IF EXISTS level;

-- Update the 'updated_at' timestamp
SELECT public.set_updated_at() WHERE true;
