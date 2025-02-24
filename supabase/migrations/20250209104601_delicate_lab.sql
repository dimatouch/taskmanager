/*
  # Add file attachments support
  
  1. Storage
    - Create task-attachments bucket
    - Add storage policies
  
  2. Activities
    - Add attachment field type
    - Update task_activities constraints
*/

-- Create storage bucket for task attachments
INSERT INTO storage.buckets (id, name)
VALUES ('task-attachments', 'task-attachments')
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload files
CREATE POLICY "Authenticated users can upload files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'task-attachments' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow authenticated users to read files
CREATE POLICY "Authenticated users can read files"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'task-attachments');

-- Allow users to delete their own files
CREATE POLICY "Users can delete their own files"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'task-attachments' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Update task_activities type check to include attachments
DO $$ 
BEGIN
  ALTER TABLE task_activities 
  DROP CONSTRAINT IF EXISTS task_activities_type_check;

  ALTER TABLE task_activities 
  ADD CONSTRAINT task_activities_type_check 
  CHECK (type IN ('update', 'create', 'delete', 'comment', 'progress', 'attachment'));

  -- Add index for faster file queries
  CREATE INDEX IF NOT EXISTS task_activities_attachment_idx 
  ON task_activities(task_id) 
  WHERE field = 'attachment';
END $$;