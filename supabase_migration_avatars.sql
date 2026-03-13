-- Avatar support: store public URL of user avatar (uploaded to Storage bucket "avatars").
-- Run once against your profiles table.
--
-- 1) Create bucket in Dashboard: Storage → New bucket → name "avatars" → set to Public
--    so that profiles.avatar_url (public URL) loads in the app.
--
-- 2) Then run this migration (column + Storage RLS). App uploads as path: <user_id>.jpg

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_url text;

-- Storage RLS: allow authenticated users to upload/update/delete only their own avatar (avatars/<user_id>.jpg)
CREATE POLICY "Users can upload own avatar"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'avatars' AND name = (auth.uid()::text || '.jpg'));

CREATE POLICY "Users can update own avatar"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'avatars' AND name = (auth.uid()::text || '.jpg'));

CREATE POLICY "Users can delete own avatar"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'avatars' AND name = (auth.uid()::text || '.jpg'));

-- Public read is handled by making the bucket Public in Dashboard; optional SELECT policy if needed:
CREATE POLICY "Anyone can view avatars"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'avatars');
