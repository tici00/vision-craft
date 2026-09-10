ALTER TABLE public.transcriptions
  ADD COLUMN IF NOT EXISTS chunk_attempts jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS active_chunk_index integer,
  ADD COLUMN IF NOT EXISTS last_chunk_started_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS plan_version integer NOT NULL DEFAULT 1;