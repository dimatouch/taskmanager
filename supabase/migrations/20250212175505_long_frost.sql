/*
  # Fix Task Files Storage
  
  1. Changes
    - Add files column to tasks table as JSONB array
    - Add trigger to handle file changes
    - Add trigger to clean up files on task deletion
    
  2. Security
    - Update storage policies for file access
*/

-- Drop existing triggers first
DROP TRIGGER IF EXISTS handle_task_file_changes_trigger ON tasks;
DROP TRIGGER IF EXISTS cleanup_task_files_trigger ON tasks;

-- Drop existing functions
DROP FUNCTION IF EXISTS handle_task_file_changes();
DROP FUNCTION IF EXISTS cleanup_task_files();

-- Ensure files column exists and is JSONB array
ALTER TABLE tasks 
DROP COLUMN IF EXISTS files;

ALTER TABLE tasks
ADD COLUMN files jsonb[] DEFAULT '{}';

-- Create index for better performance
CREATE INDEX IF NOT EXISTS tasks_files_idx ON tasks USING gin(files);

-- Create function to handle file changes
CREATE OR REPLACE FUNCTION handle_task_file_changes()
RETURNS trigger AS $$
DECLARE
  v_user_id uuid;
BEGIN
  -- Get current user ID
  SELECT auth.uid() INTO v_user_id;
  IF v_user_id IS NULL THEN
    v_user_id := '00000000-0000-0000-0000-000000000001'::uuid;
  END IF;

  -- Log file changes in task_activities
  IF NEW.files IS DISTINCT FROM OLD.files THEN
    INSERT INTO task_activities (
      task_id,
      user_id,
      type,
      field,
      old_value,
      new_value
    ) VALUES (
      NEW.id,
      v_user_id,
      'attachment',
      'files',
      array_to_json(OLD.files)::text,
      array_to_json(NEW.files)::text
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for file changes
CREATE TRIGGER handle_task_file_changes_trigger
  AFTER UPDATE OF files ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION handle_task_file_changes();

-- Create function to handle file cleanup
CREATE OR REPLACE FUNCTION cleanup_task_files()
RETURNS trigger AS $$
DECLARE
  file_record jsonb;
BEGIN
  -- Delete files from storage for each file in the array
  IF OLD.files IS NOT NULL THEN
    FOR file_record IN SELECT * FROM jsonb_array_elements(array_to_json(OLD.files)::jsonb)
    LOOP
      DELETE FROM storage.objects
      WHERE bucket_id = 'task-attachments'
      AND name = (file_record->>'path');
    END LOOP;
  END IF;
  
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
DROP POLICY IF EXISTS "Task files upload" ON storage.objects;
DROP POLICY IF EXISTS "Task files read" ON storage.objects;
DROP POLICY IF EXISTS "Task files delete" ON storage.objects;

-- Create new storage policies
CREATE POLICY "Task files upload"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'task-attachments');

CREATE POLICY "Task files read"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'task-attachments');

CREATE POLICY "Task files delete"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'task-attachments' AND
  (storage.foldername(name))[1] = auth.uid()::text
);