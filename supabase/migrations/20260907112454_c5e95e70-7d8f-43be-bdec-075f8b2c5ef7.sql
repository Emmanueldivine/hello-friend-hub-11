ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS course_code text,
  ADD COLUMN IF NOT EXISTS deadline timestamptz,
  ADD COLUMN IF NOT EXISTS student_files jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS final_file_url text,
  ADD COLUMN IF NOT EXISTS final_file_name text,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz;