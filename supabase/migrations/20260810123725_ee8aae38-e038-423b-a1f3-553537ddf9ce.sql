-- Analysis stage + status enums
DO $$ BEGIN
  CREATE TYPE public.analysis_stage AS ENUM (
    'queued','preparing','extracting_audio','detecting_language','transcribing',
    'analyzing_audio','analyzing_video','combining_signals','scoring_segments',
    'preparing_outputs','rendering','completed','failed'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.analysis_status AS ENUM ('not_configured','configured','queued','running','completed','error');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.language_mode AS ENUM ('manual','auto');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.speech_priority AS ENUM ('always','preferred','optional');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.context_level AS ENUM ('minimal','balanced','high');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.highlights_style AS ENUM ('dynamic','balanced','complete');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.analysis_mode AS ENUM ('audio_only','audio_speech','multimodal');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Projects: analysis lifecycle
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS analysis_status public.analysis_status NOT NULL DEFAULT 'not_configured',
  ADD COLUMN IF NOT EXISTS analysis_progress numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS analysis_stage public.analysis_stage,
  ADD COLUMN IF NOT EXISTS detected_language text,
  ADD COLUMN IF NOT EXISTS language_confidence numeric,
  ADD COLUMN IF NOT EXISTS analysis_error text,
  ADD COLUMN IF NOT EXISTS analysis_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS analysis_completed_at timestamptz;

-- Edit configurations: language, context and per-output settings
ALTER TABLE public.edit_configurations
  ADD COLUMN IF NOT EXISTS language_mode public.language_mode NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS primary_language text NOT NULL DEFAULT 'pt-BR',
  ADD COLUMN IF NOT EXISTS secondary_languages text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS has_multiple_languages boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS transcription_language text,
  ADD COLUMN IF NOT EXISTS content_types text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS video_context text,
  ADD COLUMN IF NOT EXISTS main_activity text,
  ADD COLUMN IF NOT EXISTS analysis_notes text,
  ADD COLUMN IF NOT EXISTS important_audio_video_flags text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS analysis_mode public.analysis_mode NOT NULL DEFAULT 'multimodal',
  ADD COLUMN IF NOT EXISTS clips_quantity_mode text NOT NULL DEFAULT 'auto',
  ADD COLUMN IF NOT EXISTS clips_quantity integer,
  ADD COLUMN IF NOT EXISTS clips_duration_preference text NOT NULL DEFAULT 'auto',
  ADD COLUMN IF NOT EXISTS clips_selection_criteria text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS avoid_similar_clips boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS speech_priority public.speech_priority NOT NULL DEFAULT 'preferred',
  ADD COLUMN IF NOT EXISTS highlights_duration_mode text NOT NULL DEFAULT 'preset',
  ADD COLUMN IF NOT EXISTS highlights_duration_minutes integer NOT NULL DEFAULT 15,
  ADD COLUMN IF NOT EXISTS highlights_editing_style public.highlights_style NOT NULL DEFAULT 'balanced',
  ADD COLUMN IF NOT EXISTS highlights_criteria text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS highlights_context_level public.context_level NOT NULL DEFAULT 'balanced',
  ADD COLUMN IF NOT EXISTS long_edit_remove_flags text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS remove_silences boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS silence_threshold_seconds integer,
  ADD COLUMN IF NOT EXISTS remove_waiting boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS remove_repetitions boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS remove_low_activity boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS preserve_visual_events boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS preserve_webcam_reactions boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS preserve_context_level public.context_level NOT NULL DEFAULT 'balanced';

ALTER TABLE public.edit_configurations
  ADD CONSTRAINT edit_configurations_clips_quantity_check
    CHECK (clips_quantity IS NULL OR (clips_quantity > 0 AND clips_quantity <= 50)) NOT VALID;

ALTER TABLE public.edit_configurations
  ADD CONSTRAINT edit_configurations_highlights_minutes_check
    CHECK (highlights_duration_minutes > 0 AND highlights_duration_minutes <= 240) NOT VALID;

ALTER TABLE public.edit_configurations
  ADD CONSTRAINT edit_configurations_silence_threshold_check
    CHECK (silence_threshold_seconds IS NULL OR (silence_threshold_seconds > 0 AND silence_threshold_seconds <= 600)) NOT VALID;

-- Video segments: multi-signal scoring prepared for real analysis
ALTER TABLE public.video_segments
  ADD COLUMN IF NOT EXISTS speech_score numeric,
  ADD COLUMN IF NOT EXISTS transcript_score numeric,
  ADD COLUMN IF NOT EXISTS visual_score numeric,
  ADD COLUMN IF NOT EXISTS reaction_score numeric,
  ADD COLUMN IF NOT EXISTS context_score numeric,
  ADD COLUMN IF NOT EXISTS audio_energy_score numeric,
  ADD COLUMN IF NOT EXISTS novelty_score numeric,
  ADD COLUMN IF NOT EXISTS overall_score numeric,
  ADD COLUMN IF NOT EXISTS reason_codes text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS reason_summary text,
  ADD COLUMN IF NOT EXISTS analysis_sources text[] NOT NULL DEFAULT '{}'::text[];

-- Processing jobs: real pipeline stage + honest worker state
ALTER TABLE public.processing_jobs
  ADD COLUMN IF NOT EXISTS stage public.analysis_stage NOT NULL DEFAULT 'queued',
  ADD COLUMN IF NOT EXISTS waiting_for_worker boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS request_payload jsonb;