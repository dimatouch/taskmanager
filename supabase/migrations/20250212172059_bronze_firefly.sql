-- First ensure the bucket exists and is public
INSERT INTO storage.buckets (id, name, public)
VALUES ('task-attachments', 'task-attachments', true)
ON CONFLICT (id) DO UPDATE
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
      'text/csv'
    ];

-- Drop existing policies
DROP POLICY IF EXISTS "Authenticated users can upload task files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can read task files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their task files" ON storage.objects;

-- Create simplified policies for file management
CREATE POLICY "Anyone can read task files"
ON storage.objects FOR SELECT
USING (bucket_id = 'task-attachments');

CREATE POLICY "Authenticated users can upload task files"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'task-attachments');

CREATE POLICY "Authenticated users can update task files"
ON storage.objects FOR UPDATE
USING (bucket_id = 'task-attachments');

CREATE POLICY "Authenticated users can delete task files"
ON storage.objects FOR DELETE
USING (bucket_id = 'task-attachments');

-- Ensure RLS is enabled but with public access
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Grant necessary permissions
GRANT ALL ON storage.objects TO authenticated;
GRANT SELECT ON storage.objects TO anon;
GRANT USAGE ON SCHEMA storage TO anon;
GRANT SELECT ON storage.buckets TO anon;

-- Update task_activities type check to include attachments
DO $$ 
BEGIN
  ALTER TABLE task_activities 
  DROP CONSTRAINT IF EXISTS task_activities_type_check;

  ALTER TABLE task_activities 
  ADD CONSTRAINT task_activities_type_check 
  CHECK (type IN ('update', 'create', 'delete', 'comment', 'progress', 'attachment', 'viewer', 'idea'));
END $$;