-- Clip Intelligence: explainable, recalibratable scores on candidates
ALTER TABLE public.clip_candidates
  ADD COLUMN IF NOT EXISTS clip_score numeric,
  ADD COLUMN IF NOT EXISTS context_score numeric,
  ADD COLUMN IF NOT EXISTS story_score numeric,
  ADD COLUMN IF NOT EXISTS novelty_score numeric,
  ADD COLUMN IF NOT EXISTS retention_potential_score numeric,
  ADD COLUMN IF NOT EXISTS creator_fit_score numeric,
  ADD COLUMN IF NOT EXISTS platform_fit_score numeric,
  ADD COLUMN IF NOT EXISTS growth_potential_score numeric,
  ADD COLUMN IF NOT EXISTS analysis_confidence numeric,
  ADD COLUMN IF NOT EXISTS context_requirement text,
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS top_signals text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS score_breakdown jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS score_weights jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS intelligence_version text,
  ADD COLUMN IF NOT EXISTS explanation text,
  ADD COLUMN IF NOT EXISTS selected boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS selection_rank integer,
  ADD COLUMN IF NOT EXISTS selection_reason text,
  ADD COLUMN IF NOT EXISTS diversity_penalty numeric,
  ADD COLUMN IF NOT EXISTS diversity_group text,
  ADD COLUMN IF NOT EXISTS manual_override text;

-- Predicted performance (what the AI expected, before publishing)
CREATE TABLE IF NOT EXISTS public.clip_performance_predictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  clip_id uuid REFERENCES public.short_clips(id) ON DELETE CASCADE,
  candidate_id uuid REFERENCES public.clip_candidates(id) ON DELETE CASCADE,
  job_id uuid REFERENCES public.processing_jobs(id) ON DELETE SET NULL,
  platform text,
  format text,
  predicted_clip_score numeric,
  predicted_growth_score numeric,
  predicted_retention numeric,
  predicted_shareability numeric,
  predicted_comment_potential numeric,
  score_breakdown jsonb NOT NULL DEFAULT '{}'::jsonb,
  signals jsonb NOT NULL DEFAULT '{}'::jsonb,
  model text,
  intelligence_version text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Observed performance (what really happened after publishing)
CREATE TABLE IF NOT EXISTS public.clip_performance_observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  clip_id uuid REFERENCES public.short_clips(id) ON DELETE CASCADE,
  platform text NOT NULL,
  publication_url text,
  published_at timestamptz,
  caption text,
  hashtags text[] NOT NULL DEFAULT '{}'::text[],
  format text,
  clip_duration_seconds numeric,
  views bigint,
  likes bigint,
  comments bigint,
  shares bigint,
  saves bigint,
  average_watch_seconds numeric,
  retention_rate numeric,
  completion_rate numeric,
  growth_timeline jsonb NOT NULL DEFAULT '[]'::jsonb,
  observed_score numeric,
  raw_metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  source text NOT NULL DEFAULT 'manual',
  measured_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Creator performance profile (learned from real observed data only)
CREATE TABLE IF NOT EXISTS public.creator_performance_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_key text NOT NULL UNIQUE,
  display_name text,
  clip_types jsonb NOT NULL DEFAULT '{}'::jsonb,
  topics jsonb NOT NULL DEFAULT '{}'::jsonb,
  durations jsonb NOT NULL DEFAULT '{}'::jsonb,
  hook_styles jsonb NOT NULL DEFAULT '{}'::jsonb,
  emotions jsonb NOT NULL DEFAULT '{}'::jsonb,
  formats jsonb NOT NULL DEFAULT '{}'::jsonb,
  platforms jsonb NOT NULL DEFAULT '{}'::jsonb,
  posting_times jsonb NOT NULL DEFAULT '{}'::jsonb,
  caption_patterns jsonb NOT NULL DEFAULT '{}'::jsonb,
  retention_patterns jsonb NOT NULL DEFAULT '{}'::jsonb,
  share_patterns jsonb NOT NULL DEFAULT '{}'::jsonb,
  comment_patterns jsonb NOT NULL DEFAULT '{}'::jsonb,
  top_content jsonb NOT NULL DEFAULT '[]'::jsonb,
  sample_size integer NOT NULL DEFAULT 0,
  last_computed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.clip_performance_predictions TO anon, authenticated;
GRANT ALL ON public.clip_performance_predictions TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clip_performance_observations TO anon, authenticated;
GRANT ALL ON public.clip_performance_observations TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.creator_performance_profiles TO anon, authenticated;
GRANT ALL ON public.creator_performance_profiles TO service_role;

ALTER TABLE public.clip_performance_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clip_performance_observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creator_performance_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Open access to clip_performance_predictions" ON public.clip_performance_predictions FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Open access to clip_performance_observations" ON public.clip_performance_observations FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Open access to creator_performance_profiles" ON public.creator_performance_profiles FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER clip_performance_predictions_updated_at BEFORE UPDATE ON public.clip_performance_predictions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER clip_performance_observations_updated_at BEFORE UPDATE ON public.clip_performance_observations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER creator_performance_profiles_updated_at BEFORE UPDATE ON public.creator_performance_profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS clip_perf_pred_project_idx ON public.clip_performance_predictions(project_id);
CREATE INDEX IF NOT EXISTS clip_perf_obs_project_idx ON public.clip_performance_observations(project_id);
CREATE INDEX IF NOT EXISTS clip_candidates_selected_idx ON public.clip_candidates(project_id, selected, selection_rank);