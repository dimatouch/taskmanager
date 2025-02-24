-- First ensure the bucket exists and is public
INSERT INTO storage.buckets (id, name, public)
VALUES ('task-attachments', 'task-attachments', true)
ON CONFLICT (id) DO UPDATE
SET public = true;

-- Drop existing policies
DROP POLICY IF EXISTS "Authenticated users can upload files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can read files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own files" ON storage.objects;

-- Create improved policies for file management
CREATE POLICY "Authenticated users can upload task files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'task-attachments' AND
  auth.role() = 'authenticated'
);

CREATE POLICY "Authenticated users can read task files"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'task-attachments' AND
  auth.role() = 'authenticated'
);

CREATE POLICY "Users can delete their task files"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'task-attachments' AND
  auth.role() = 'authenticated'
);

-- Update task_activities type check to include attachments
DO $$ 
BEGIN
  -- First check existing types
  IF EXISTS (
    SELECT 1 FROM task_activities 
    WHERE type NOT IN ('update', 'create', 'delete', 'comment', 'progress', 'attachment', 'viewer', 'idea')
  ) THEN
    -- Update any invalid types to 'update'
    UPDATE task_activities 
    SET type = 'update'
    WHERE type NOT IN ('update', 'create', 'delete', 'comment', 'progress', 'attachment', 'viewer', 'idea');
  END IF;

  -- Now safe to update constraint
  ALTER TABLE task_activities 
  DROP CONSTRAINT IF EXISTS task_activities_type_check;

  ALTER TABLE task_activities 
  ADD CONSTRAINT task_activities_type_check 
  CHECK (type IN ('update', 'create', 'delete', 'comment', 'progress', 'attachment', 'viewer', 'idea'));
END $$;