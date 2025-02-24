-- First ensure the bucket exists and is public
INSERT INTO storage.buckets (id, name, public)
VALUES ('task-attachments', 'task-attachments', true)
ON CONFLICT (id) DO UPDATE
SET public = true;

-- Drop existing policies
DROP POLICY IF EXISTS "Authenticated users can upload task files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can read task files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their task files" ON storage.objects;

-- Create improved policies for file management
CREATE POLICY "Authenticated users can upload task files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'task-attachments' AND
  (storage.foldername(name))[1] = auth.uid()::text AND
  (storage.foldername(name))[2] IS NOT NULL
);

CREATE POLICY "Authenticated users can read task files"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'task-attachments');

CREATE POLICY "Users can delete their task files"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'task-attachments' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Create function to handle file uploads
CREATE OR REPLACE FUNCTION handle_task_file_upload()
RETURNS trigger AS $$
BEGIN
  -- Ensure the file path follows the pattern: user_id/task_id/filename
  IF array_length(string_to_array(NEW.name, '/'), 1) != 3 THEN
    RAISE EXCEPTION 'Invalid file path format';
  END IF;

  -- Verify user has access to the task
  IF NOT EXISTS (
    SELECT 1 FROM tasks t
    WHERE t.id = (storage.foldername(NEW.name))[2]::uuid
    AND (
      t.owner_id = auth.uid() OR
      t.responsible_id = auth.uid() OR
      auth.uid() = ANY(t.coworkers)
    )
  ) THEN
    RAISE EXCEPTION 'User does not have access to this task';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for file uploads
DROP TRIGGER IF EXISTS handle_task_file_upload_trigger ON storage.objects;
CREATE TRIGGER handle_task_file_upload_trigger
  BEFORE INSERT ON storage.objects
  FOR EACH ROW
  WHEN (NEW.bucket_id = 'task-attachments')
  EXECUTE FUNCTION handle_task_file_upload();