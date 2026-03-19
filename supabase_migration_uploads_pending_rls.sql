-- Storage RLS for private staging bucket: uploads_pending
-- Goal:
-- - Authenticated users can upload/update/delete ONLY within their own folder: uploads_pending/<auth.uid()>/...
-- - No public read (bucket stays private).
--
-- Notes:
-- - Storage policies apply on storage.objects.
-- - Supabase service role (Edge Functions) bypasses RLS, so publishing to public buckets remains server-controlled.

-- Allow authenticated users to INSERT into their own folder
CREATE POLICY "Users can upload to own uploads_pending folder"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'uploads_pending'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow authenticated users to UPDATE objects in their own folder
CREATE POLICY "Users can update own uploads_pending objects"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'uploads_pending'
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'uploads_pending'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow authenticated users to DELETE objects in their own folder
CREATE POLICY "Users can delete own uploads_pending objects"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'uploads_pending'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Optional: allow the owner to SELECT their own staged objects (useful for debugging).
-- If you don't need client-side reads from uploads_pending, you can omit this.
CREATE POLICY "Users can view own uploads_pending objects"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'uploads_pending'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- ------------------------------------------------------------
-- Hardening (recommended): prevent clients from writing to public buckets.
-- Run these only if you currently allow authenticated INSERT/UPDATE/DELETE on these buckets.
-- With no policies for authenticated on these buckets, client writes will be blocked and only service_role can publish.
--
-- Example:
--   DROP POLICY IF EXISTS "Users can upload own avatar" ON storage.objects;
--   DROP POLICY IF EXISTS "Users can update own avatar" ON storage.objects;
--   DROP POLICY IF EXISTS "Users can delete own avatar" ON storage.objects;
--
-- If you also created policies for sunrise_photos, drop them similarly.

