-- Drop existing policies
DROP POLICY IF EXISTS "Anyone can read task files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload task files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update task files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete task files" ON storage.objects;

-- Create maximally permissive policies
CREATE POLICY "Full public access to files"
ON storage.objects FOR ALL
USING (bucket_id = 'task-attachments')
WITH CHECK (bucket_id = 'task-attachments');

-- Ensure bucket is public and properly configured
UPDATE storage.buckets
SET public = true,
    file_size_limit = 52428800, -- 50MB limit
    allowed_mime_types = ARRAY[
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'text/plain',
      'text/csv',
      'application/zip',
      'application/x-zip-compressed'
    ]
WHERE id = 'task-attachments';

-- Grant all permissions to public
GRANT ALL ON storage.objects TO public;
GRANT ALL ON storage.buckets TO public;
GRANT USAGE ON SCHEMA storage TO public;

-- Disable RLS for maximum access
ALTER TABLE storage.objects DISABLE ROW LEVEL SECURITY;