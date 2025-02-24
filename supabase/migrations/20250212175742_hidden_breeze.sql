/*
  # Fix Task Files Implementation
  
  1. Changes
    - Drop existing policies to avoid conflicts
    - Update files column to be JSONB (not JSONB array)
    - Add proper storage policies
    
  2. Security
    - Ensure proper file access control
    - Clean up files on task deletion
*/

-- Drop existing policies
DROP POLICY IF EXISTS "task_files_upload_policy" ON storage.objects;
DROP POLICY IF EXISTS "task_files_read_policy" ON storage.objects;
DROP POLICY IF EXISTS "task_files_delete_policy" ON storage.objects;

-- Drop existing triggers first
DROP TRIGGER IF EXISTS handle_task_file_changes_trigger ON tasks;
DROP TRIGGER IF EXISTS cleanup_task_files_trigger ON tasks;

-- Drop existing functions
DROP FUNCTION IF EXISTS handle_task_file_changes();
DROP FUNCTION IF EXISTS cleanup_task_files();

-- Drop and recreate files column as JSONB (not JSONB array)
ALTER TABLE tasks 
DROP COLUMN IF EXISTS files;

ALTER TABLE tasks
ADD COLUMN files jsonb DEFAULT '[]'::jsonb;

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
      COALESCE(OLD.files::text, '[]'),
      COALESCE(NEW.files::text, '[]')
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
  IF OLD.files IS NOT NULL AND jsonb_array_length(OLD.files) > 0 THEN
    FOR file_record IN SELECT * FROM jsonb_array_elements(OLD.files)
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

-- Create new storage policies with unique names
CREATE POLICY "task_attachments_policy_upload"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'task-attachments');

CREATE POLICY "task_attachments_policy_read"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'task-attachments');

CREATE POLICY "task_attachments_policy_delete"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'task-attachments' AND
  (storage.foldername(name))[1] = auth.uid()::text
);