/*
  # Add task files tracking

  1. New Tables
    - `task_files`
      - `id` (uuid, primary key)
      - `task_id` (uuid, references tasks)
      - `name` (text)
      - `path` (text)
      - `size` (bigint)
      - `type` (text)
      - `uploaded_by` (uuid, references auth.users)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on task_files table
    - Add policies for task file management
    - Update storage policies for better security
*/

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
  USING (true);

CREATE POLICY "Users can manage task files"
  ON task_files
  FOR ALL
  TO authenticated
  USING (uploaded_by = auth.uid())
  WITH CHECK (uploaded_by = auth.uid());

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

-- Update storage policies
CREATE POLICY "Anyone can read task files"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'task-attachments');

CREATE POLICY "Authenticated users can upload task files"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'task-attachments');

CREATE POLICY "Users can delete their task files"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'task-attachments' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Create function to handle file deletion
CREATE OR REPLACE FUNCTION handle_task_file_deletion()
RETURNS trigger AS $$
BEGIN
  -- Delete corresponding storage object
  DELETE FROM storage.objects
  WHERE bucket_id = 'task-attachments'
  AND name = OLD.path;
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for file deletion
CREATE TRIGGER handle_task_file_deletion_trigger
  BEFORE DELETE ON task_files
  FOR EACH ROW
  EXECUTE FUNCTION handle_task_file_deletion();