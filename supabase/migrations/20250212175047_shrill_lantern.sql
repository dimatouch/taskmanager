/*
  # Fix Task Files Migration

  1. Changes
    - Drop and recreate task_files table
    - Update storage policies
    - Add cleanup triggers
    - Fix RLS policies

  2. Security
    - Enable RLS on task_files table
    - Add proper access control policies
*/

-- Drop existing table and related objects
DROP TABLE IF EXISTS task_files CASCADE;

-- Create task_files table
CREATE TABLE task_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid REFERENCES tasks(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  path text NOT NULL,
  size bigint NOT NULL,
  type text NOT NULL,
  uploaded_by uuid REFERENCES auth.users(id) NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create indexes for better performance
CREATE INDEX task_files_task_id_idx ON task_files(task_id);
CREATE INDEX task_files_uploaded_by_idx ON task_files(uploaded_by);

-- Enable RLS
ALTER TABLE task_files ENABLE ROW LEVEL SECURITY;

-- Create policies for task_files
CREATE POLICY "Users can view task files"
  ON task_files
  FOR SELECT
  TO authenticated
  USING (
    -- Users can view files if they:
    EXISTS (
      SELECT 1 FROM tasks t
      WHERE t.id = task_files.task_id
      AND (
        -- Own the task
        t.owner_id = auth.uid() OR
        -- Are responsible for the task
        t.responsible_id = auth.uid() OR
        -- Are a co-worker
        auth.uid() = ANY(t.coworkers) OR
        -- Are a viewer
        EXISTS (
          SELECT 1 FROM task_roles tr
          WHERE tr.task_id = t.id
          AND tr.user_id = auth.uid()
          AND tr.role = 'viewer'
        )
      )
    )
  );

CREATE POLICY "Users can upload files to their tasks"
  ON task_files
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Users can upload files if they:
    EXISTS (
      SELECT 1 FROM tasks t
      WHERE t.id = task_files.task_id
      AND (
        -- Own the task
        t.owner_id = auth.uid() OR
        -- Are responsible for the task
        t.responsible_id = auth.uid() OR
        -- Are a co-worker
        auth.uid() = ANY(t.coworkers)
      )
    )
  );

CREATE POLICY "Users can delete their uploaded files"
  ON task_files
  FOR DELETE
  TO authenticated
  USING (
    -- Users can delete files if they:
    uploaded_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM tasks t
      WHERE t.id = task_files.task_id
      AND (
        -- Own the task
        t.owner_id = auth.uid() OR
        -- Are responsible for the task
        t.responsible_id = auth.uid()
      )
    )
  );

-- Drop existing function and trigger if they exist
DROP TRIGGER IF EXISTS cleanup_task_files_trigger ON tasks;
DROP FUNCTION IF EXISTS cleanup_task_files();

-- Create function to handle file cleanup
CREATE OR REPLACE FUNCTION cleanup_task_files()
RETURNS trigger AS $$
BEGIN
  -- Delete files from storage
  DELETE FROM storage.objects
  WHERE bucket_id = 'task-attachments'
  AND path LIKE OLD.id || '/%';
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for file cleanup
CREATE TRIGGER cleanup_task_files_trigger
  BEFORE DELETE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION cleanup_task_files();

-- Update storage bucket configuration
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

-- Drop existing storage policies
DROP POLICY IF EXISTS "Authenticated users can upload files" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can read files" ON storage.objects;
DROP POLICY IF EXISTS "File owners can delete files" ON storage.objects;

-- Create storage policies
CREATE POLICY "Authenticated users can upload files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'task-attachments');

CREATE POLICY "Anyone can read files"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'task-attachments');

CREATE POLICY "File owners can delete files"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'task-attachments' AND
  (storage.foldername(name))[1] = auth.uid()::text
);