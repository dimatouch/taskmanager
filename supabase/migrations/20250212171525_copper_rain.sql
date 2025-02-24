-- First ensure the bucket exists and is public
INSERT INTO storage.buckets (id, name, public)
VALUES ('task-attachments', 'task-attachments', true)
ON CONFLICT (id) DO UPDATE
SET public = true;

-- Drop existing policies
DROP POLICY IF EXISTS "Authenticated users can upload task files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can read task files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their task files" ON storage.objects;

-- Create simplified policies for file management
CREATE POLICY "Authenticated users can upload task files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'task-attachments');

CREATE POLICY "Authenticated users can read task files"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'task-attachments');

CREATE POLICY "Users can delete their task files"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'task-attachments');

-- Drop any existing triggers that might interfere
DROP TRIGGER IF EXISTS handle_task_file_upload_trigger ON storage.objects;