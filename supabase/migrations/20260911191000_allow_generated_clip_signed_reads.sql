-- Generated clips stay in a private bucket, but the app needs SELECT access
-- to create short-lived signed URLs for browser playback/download.
DROP POLICY IF EXISTS "Allow generated clips signed reads" ON storage.objects;

CREATE POLICY "Allow generated clips signed reads"
ON storage.objects
FOR SELECT
TO anon, authenticated
USING (bucket_id = 'generated-clips');
