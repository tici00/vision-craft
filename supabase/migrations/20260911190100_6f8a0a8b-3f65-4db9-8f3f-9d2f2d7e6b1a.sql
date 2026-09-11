-- Rendered clip files live in the private generated-clips bucket.
-- Store the app's server media proxy as the stable playback/download URL so
-- clients never need Storage object SELECT permissions to create signed URLs.

UPDATE public.short_clips
SET video_url = '/api/public/generated-clips/' || id::text
WHERE video_storage_path IS NOT NULL
  AND (video_url IS NULL OR video_url = '' OR video_url LIKE '%.supabase.co/storage/%');

CREATE OR REPLACE FUNCTION public.set_generated_clip_proxy_url()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.video_storage_path IS NOT NULL
     AND (NEW.video_url IS NULL OR NEW.video_url = '') THEN
    NEW.video_url := '/api/public/generated-clips/' || NEW.id::text;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS short_clips_generated_proxy_url ON public.short_clips;
CREATE TRIGGER short_clips_generated_proxy_url
BEFORE INSERT OR UPDATE OF video_storage_path, video_url
ON public.short_clips
FOR EACH ROW
EXECUTE FUNCTION public.set_generated_clip_proxy_url();
