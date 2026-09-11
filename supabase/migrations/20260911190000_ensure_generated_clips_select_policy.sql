-- Final safety net for rendered clip playback/download.
-- Preview and Download use short-lived signed URLs from the generated-clips bucket.
-- Signed URL creation requires SELECT access on storage.objects.
DO $$
BEGIN
  DROP POLICY IF EXISTS "Open read generated clips" ON storage.objects;

  CREATE POLICY "Open read generated clips"
    ON storage.objects
    FOR SELECT
    TO anon, authenticated
    USING (bucket_id = 'generated-clips');
END $$;
