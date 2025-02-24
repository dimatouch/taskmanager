/*
  # Add Files to Tasks Table
  
  1. Changes
    - Add files column to tasks table to store file information
    - Drop task_files table since we'll store files directly in tasks
    - Update storage policies
    
  2. Security
    - Maintain RLS policies for file access
*/

-- Drop existing task_files table
DROP TABLE IF EXISTS task_files CASCADE;

-- Add files column to tasks table
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS files jsonb[] DEFAULT '{}';

-- Create index for better performance
CREATE INDEX tasks_files_idx ON tasks USING gin(files);

-- Drop existing function and trigger if they exist
DROP TRIGGER IF EXISTS cleanup_task_files_trigger ON tasks;
DROP FUNCTION IF EXISTS cleanup_task_files();

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