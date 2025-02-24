-- First delete any existing objects in the bucket
DELETE FROM storage.objects
WHERE bucket_id = 'task-attachments';

-- Create storage bucket for task attachments if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('task-attachments', 'task-attachments', true)
ON CONFLICT (id) DO UPDATE
SET public = true;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Authenticated users can upload files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can read files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own files" ON storage.objects;

-- Create policies for file management
CREATE POLICY "Authenticated users can upload files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'task-attachments' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Authenticated users can read files"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'task-attachments');

CREATE POLICY "Users can delete their own files"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'task-attachments' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Enable RLS
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Create task_attachments table
CREATE TABLE IF NOT EXISTS task_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid REFERENCES tasks(id) ON DELETE CASCADE,
  file_path text NOT NULL,
  file_name text NOT NULL,
  file_type text NOT NULL,
  file_size bigint NOT NULL,
  uploaded_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS task_attachments_task_id_idx ON task_attachments(task_id);
CREATE INDEX IF NOT EXISTS task_attachments_uploaded_by_idx ON task_attachments(uploaded_by);

-- Enable RLS on task_attachments
ALTER TABLE task_attachments ENABLE ROW LEVEL SECURITY;

-- Create policy for task_attachments
CREATE POLICY "Full access to task attachments"
  ON task_attachments
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);