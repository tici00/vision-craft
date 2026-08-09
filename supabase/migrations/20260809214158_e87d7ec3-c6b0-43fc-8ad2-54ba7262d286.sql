CREATE TYPE public.project_status AS ENUM ('draft','ready','queued','processing','analyzing','generating_clips','rendering','completed','error');
CREATE TYPE public.job_status AS ENUM ('queued','running','completed','cancelled','error');
CREATE TYPE public.edit_intensity AS ENUM ('conservative','balanced','aggressive');
CREATE TYPE public.segment_decision AS ENUM ('keep','cut','undecided');
CREATE TYPE public.generated_video_kind AS ENUM ('highlights','long_edit');

CREATE OR REPLACE FUNCTION public.update_updated_at_column() RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql SET search_path = public;

CREATE TABLE public.projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  source_file_name TEXT,
  source_file_size BIGINT,
  source_mime_type TEXT,
  source_storage_path TEXT,
  source_url TEXT,
  duration_seconds NUMERIC,
  thumbnail_url TEXT,
  status public.project_status NOT NULL DEFAULT 'draft',
  processing_types TEXT[] NOT NULL DEFAULT '{}',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.edit_configurations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE UNIQUE,
  want_short_clips BOOLEAN NOT NULL DEFAULT false,
  want_highlights BOOLEAN NOT NULL DEFAULT false,
  want_long_edit BOOLEAN NOT NULL DEFAULT false,
  highlights_target_seconds INTEGER,
  long_edit_intensity public.edit_intensity,
  clip_min_seconds INTEGER,
  clip_max_seconds INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.processing_jobs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  status public.job_status NOT NULL DEFAULT 'queued',
  progress NUMERIC NOT NULL DEFAULT 0,
  current_step TEXT,
  steps JSONB NOT NULL DEFAULT '[]'::jsonb,
  queued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  estimated_seconds_remaining INTEGER,
  cancel_requested BOOLEAN NOT NULL DEFAULT false,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX processing_jobs_project_idx ON public.processing_jobs(project_id);

CREATE TABLE public.video_segments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  start_seconds NUMERIC NOT NULL,
  end_seconds NUMERIC NOT NULL,
  duration_seconds NUMERIC NOT NULL,
  decision public.segment_decision NOT NULL DEFAULT 'undecided',
  score NUMERIC,
  reason TEXT,
  category TEXT,
  related_result_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX video_segments_project_idx ON public.video_segments(project_id);

CREATE TABLE public.short_clips (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  duration_seconds NUMERIC NOT NULL,
  source_start_seconds NUMERIC NOT NULL,
  category TEXT,
  confidence NUMERIC,
  thumbnail_url TEXT,
  video_storage_path TEXT,
  video_url TEXT,
  kept BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX short_clips_project_idx ON public.short_clips(project_id);

CREATE TABLE public.generated_videos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  kind public.generated_video_kind NOT NULL,
  original_duration_seconds NUMERIC,
  final_duration_seconds NUMERIC,
  removed_seconds NUMERIC,
  cuts_count INTEGER,
  segment_ids UUID[] NOT NULL DEFAULT '{}',
  thumbnail_url TEXT,
  video_storage_path TEXT,
  video_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX generated_videos_project_idx ON public.generated_videos(project_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.projects TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.edit_configurations TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.processing_jobs TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.video_segments TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.short_clips TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.generated_videos TO anon, authenticated;
GRANT ALL ON public.projects TO service_role;
GRANT ALL ON public.edit_configurations TO service_role;
GRANT ALL ON public.processing_jobs TO service_role;
GRANT ALL ON public.video_segments TO service_role;
GRANT ALL ON public.short_clips TO service_role;
GRANT ALL ON public.generated_videos TO service_role;

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.edit_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.processing_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.short_clips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generated_videos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Open access to projects" ON public.projects FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Open access to edit_configurations" ON public.edit_configurations FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Open access to processing_jobs" ON public.processing_jobs FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Open access to video_segments" ON public.video_segments FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Open access to short_clips" ON public.short_clips FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Open access to generated_videos" ON public.generated_videos FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER projects_updated_at BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER edit_configurations_updated_at BEFORE UPDATE ON public.edit_configurations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER processing_jobs_updated_at BEFORE UPDATE ON public.processing_jobs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER video_segments_updated_at BEFORE UPDATE ON public.video_segments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER short_clips_updated_at BEFORE UPDATE ON public.short_clips FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER generated_videos_updated_at BEFORE UPDATE ON public.generated_videos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();