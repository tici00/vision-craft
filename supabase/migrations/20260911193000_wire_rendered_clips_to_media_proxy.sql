-- Rendered clips are persisted in Supabase Storage by the processing pipeline.
-- Keep the frontend's existing video_url contract, but point it at the
-- server-side media proxy so playback/download does not depend on the browser
-- having SELECT access to storage.objects.

CREATE OR REPLACE FUNCTION public.sync_rendered_clip_media_url()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.video_storage_path IS NOT NULL THEN
    NEW.video_url := '/api/public/generated-clips/' || NEW.id::text;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_rendered_clip_media_url ON public.short_clips;

CREATE TRIGGER sync_rendered_clip_media_url
BEFORE INSERT OR UPDATE OF video_storage_path
ON public.short_clips
FOR EACH ROW
EXECUTE FUNCTION public.sync_rendered_clip_media_url();

-- Repair the clips already rendered before the trigger existed.
UPDATE public.short_clips
SET video_url = '/api/public/generated-clips/' || id::text
WHERE video_storage_path IS NOT NULL;
