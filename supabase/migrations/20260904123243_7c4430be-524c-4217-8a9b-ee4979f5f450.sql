ALTER TABLE public.transcriptions
  ADD COLUMN IF NOT EXISTS chunk_plan jsonb,
  ADD COLUMN IF NOT EXISTS chunk_count integer,
  ADD COLUMN IF NOT EXISTS completed_chunks integer[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS error_message text,
  ADD COLUMN IF NOT EXISTS audio_url text;

CREATE UNIQUE INDEX IF NOT EXISTS transcriptions_project_job_key
  ON public.transcriptions (project_id, job_id);