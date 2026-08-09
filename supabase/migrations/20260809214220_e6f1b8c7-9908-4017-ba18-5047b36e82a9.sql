CREATE POLICY "Open read source videos" ON storage.objects FOR SELECT TO anon, authenticated USING (bucket_id = 'source-videos');
CREATE POLICY "Open upload source videos" ON storage.objects FOR INSERT TO anon, authenticated WITH CHECK (bucket_id = 'source-videos');
CREATE POLICY "Open update source videos" ON storage.objects FOR UPDATE TO anon, authenticated USING (bucket_id = 'source-videos');
CREATE POLICY "Open delete source videos" ON storage.objects FOR DELETE TO anon, authenticated USING (bucket_id = 'source-videos');