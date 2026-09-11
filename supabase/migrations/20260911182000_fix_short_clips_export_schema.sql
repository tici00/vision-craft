-- short_clips does not have a `kind` column; clip exports are identified by
-- the export request itself. Keep a compatibility value for older frontend
-- code that still selects this field while the export flow is being hardened.
ALTER TABLE public.short_clips
  ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'clip';

UPDATE public.short_clips
SET kind = 'clip'
WHERE kind IS NULL OR kind = '';
