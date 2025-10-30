-- Create screenshots storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'screenshots',
  'screenshots',
  true,
  10485760, -- 10MB in bytes
  ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Storage RLS policies
CREATE POLICY "Authenticated users can upload screenshots"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'screenshots');

CREATE POLICY "Public can view screenshots"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'screenshots');

CREATE POLICY "Users can update own screenshots"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'screenshots' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can delete own screenshots"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'screenshots' AND (storage.foldername(name))[1] = auth.uid()::text);

