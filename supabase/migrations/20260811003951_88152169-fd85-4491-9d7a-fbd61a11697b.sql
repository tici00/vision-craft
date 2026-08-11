-- transcriptions
CREATE TABLE public.transcriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  job_id uuid REFERENCES public.processing_jobs(id) ON DELETE SET NULL,
  language text,
  requested_language text,
  detected_language text,
  text text NOT NULL DEFAULT '',
  segments jsonb NOT NULL DEFAULT '[]'::jsonb,
  provider text,
  model text,
  source_kind text,
  source_storage_path text,
  duration_seconds numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transcriptions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transcriptions TO anon;
GRANT ALL ON public.transcriptions TO service_role;
ALTER TABLE public.transcriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Open access to transcriptions" ON public.transcriptions FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER transcriptions_updated_at BEFORE UPDATE ON public.transcriptions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX transcriptions_project_id_idx ON public.transcriptions(project_id);

-- clip candidates
CREATE TABLE public.clip_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  job_id uuid REFERENCES public.processing_jobs(id) ON DELETE SET NULL,
  start_seconds numeric NOT NULL,
  end_seconds numeric NOT NULL,
  duration_seconds numeric NOT NULL,
  title text NOT NULL DEFAULT '',
  description text,
  reason text,
  criteria text[] NOT NULL DEFAULT '{}'::text[],
  topic text,
  has_speech boolean,
  score numeric,
  order_index integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'selected',
  status_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clip_candidates TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clip_candidates TO anon;
GRANT ALL ON public.clip_candidates TO service_role;
ALTER TABLE public.clip_candidates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Open access to clip_candidates" ON public.clip_candidates FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER clip_candidates_updated_at BEFORE UPDATE ON public.clip_candidates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX clip_candidates_project_id_idx ON public.clip_candidates(project_id);

-- short clips: real render tracking
ALTER TABLE public.short_clips
  ADD COLUMN IF NOT EXISTS source_end_seconds numeric,
  ADD COLUMN IF NOT EXISTS order_index integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reason text,
  ADD COLUMN IF NOT EXISTS criteria text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS render_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS render_error text,
  ADD COLUMN IF NOT EXISTS file_size_bytes bigint,
  ADD COLUMN IF NOT EXISTS candidate_id uuid REFERENCES public.clip_candidates(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS job_id uuid REFERENCES public.processing_jobs(id) ON DELETE SET NULL;

-- processing jobs: technical diagnostics
ALTER TABLE public.processing_jobs
  ADD COLUMN IF NOT EXISTS logs jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS stage_message text,
  ADD COLUMN IF NOT EXISTS last_heartbeat_at timestamptz,
  ADD COLUMN IF NOT EXISTS failed_stage analysis_stage;

-- generated videos: ordering and source timestamps
ALTER TABLE public.generated_videos
  ADD COLUMN IF NOT EXISTS order_index integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS source_start_seconds numeric,
  ADD COLUMN IF NOT EXISTS source_end_seconds numeric,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

-- passive usage record (no limits enforced)
CREATE TABLE public.processing_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  job_id uuid REFERENCES public.processing_jobs(id) ON DELETE SET NULL,
  source_duration_seconds numeric,
  transcribed_seconds numeric,
  rendered_clips integer,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.processing_usage TO authenticated;
GRANT SELECT, INSERT ON public.processing_usage TO anon;
GRANT ALL ON public.processing_usage TO service_role;
ALTER TABLE public.processing_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Open access to processing_usage" ON public.processing_usage FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);