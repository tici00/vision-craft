-- Generated clips are persisted in Supabase Storage by the processing pipeline.
-- The UI uses short-lived signed URLs for Preview and Download, which requires
-- SELECT access on storage.objects for the generated-clips bucket.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Open read generated clips'
  ) THEN
    CREATE POLICY "Open read generated clips"
      ON storage.objects
      FOR SELECT
      TO anon, authenticated
      USING (bucket_id = 'generated-clips');
  END IF;
END $$;
