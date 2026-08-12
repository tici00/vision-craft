-- Processing jobs: config snapshot, requested outputs, worker task tracking, recovery
ALTER TABLE public.processing_jobs
  ADD COLUMN IF NOT EXISTS requested_outputs text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS configuration_snapshot jsonb,
  ADD COLUMN IF NOT EXISTS worker_task_id text,
  ADD COLUMN IF NOT EXISTS worker_stage text,
  ADD COLUMN IF NOT EXISTS worker_last_sync_at timestamptz,
  ADD COLUMN IF NOT EXISTS worker_payload jsonb,
  ADD COLUMN IF NOT EXISTS attempt_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS stage_started_at timestamptz;

-- Clip candidates: structured space for future intelligence evaluations
ALTER TABLE public.clip_candidates
  ADD COLUMN IF NOT EXISTS transcript_excerpt text,
  ADD COLUMN IF NOT EXISTS keywords text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS analysis_notes text,
  ADD COLUMN IF NOT EXISTS analysis_sources text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS evaluations jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS quality_score numeric,
  ADD COLUMN IF NOT EXISTS relevance_score numeric,
  ADD COLUMN IF NOT EXISTS emotion_score numeric,
  ADD COLUMN IF NOT EXISTS hook_score numeric,
  ADD COLUMN IF NOT EXISTS curiosity_score numeric,
  ADD COLUMN IF NOT EXISTS retention_score numeric,
  ADD COLUMN IF NOT EXISTS payoff_score numeric,
  ADD COLUMN IF NOT EXISTS clarity_score numeric,
  ADD COLUMN IF NOT EXISTS pacing_score numeric,
  ADD COLUMN IF NOT EXISTS shareability_score numeric,
  ADD COLUMN IF NOT EXISTS comment_potential_score numeric,
  ADD COLUMN IF NOT EXISTS replay_score numeric,
  ADD COLUMN IF NOT EXISTS originality_score numeric,
  ADD COLUMN IF NOT EXISTS creator_affinity_score numeric,
  ADD COLUMN IF NOT EXISTS overall_potential_score numeric,
  ADD COLUMN IF NOT EXISTS reach_expansion_score numeric,
  ADD COLUMN IF NOT EXISTS evaluated_at timestamptz,
  ADD COLUMN IF NOT EXISTS evaluation_model text;

-- Short clips: space for future publication + performance intelligence
ALTER TABLE public.short_clips
  ADD COLUMN IF NOT EXISTS platform text,
  ADD COLUMN IF NOT EXISTS published boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS published_at timestamptz,
  ADD COLUMN IF NOT EXISTS publication_caption text,
  ADD COLUMN IF NOT EXISTS publication_hashtags text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS publication_url text,
  ADD COLUMN IF NOT EXISTS metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS performance jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS predicted_performance jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS actual_result jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS feedback jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS metrics_updated_at timestamptz;

-- Processing usage: richer accounting per stage
ALTER TABLE public.processing_usage
  ADD COLUMN IF NOT EXISTS worker_seconds numeric,
  ADD COLUMN IF NOT EXISTS stage_details jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS clip_candidates_job_idx ON public.clip_candidates (job_id);
CREATE INDEX IF NOT EXISTS short_clips_job_idx ON public.short_clips (job_id);
CREATE INDEX IF NOT EXISTS processing_jobs_project_idx ON public.processing_jobs (project_id);
CREATE INDEX IF NOT EXISTS processing_jobs_worker_task_idx ON public.processing_jobs (worker_task_id);