-- The client creates short-lived signed URLs for Preview and Download.
-- Signed URLs require SELECT access to storage.objects for the target bucket.
DROP POLICY IF EXISTS "Open read generated clips" ON storage.objects;

CREATE POLICY "Open read generated clips"
  ON storage.objects
  FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'generated-clips');
