ALTER TABLE public.short_clips
  ADD COLUMN IF NOT EXISTS render_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS render_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS render_job_id uuid;

CREATE INDEX IF NOT EXISTS short_clips_render_status_idx
  ON public.short_clips (project_id, render_status);