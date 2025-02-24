-- First drop triggers that depend on files column
DROP TRIGGER IF EXISTS handle_task_file_changes_trigger ON tasks;
DROP FUNCTION IF EXISTS handle_task_file_changes();

-- Create function to sanitize filenames
CREATE OR REPLACE FUNCTION sanitize_filename(filename text)
RETURNS text AS $$
DECLARE
  clean_name text;
BEGIN
  -- Replace non-ASCII characters with their ASCII equivalents
  clean_name := translate(filename,
    'абвгдеёжзийклмнопрстуфхцчшщъыьэюяАБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ',
    'abvgdeejzijklmnoprstufhzcssyyyeuaABVGDEEJZIJKLMNOPRSTUFHZCSSYYYEUA'
  );
  
  -- Replace spaces and special characters with underscores
  clean_name := regexp_replace(clean_name, '[^a-zA-Z0-9.-]', '_', 'g');
  
  -- Remove multiple consecutive underscores
  clean_name := regexp_replace(clean_name, '_+', '_', 'g');
  
  -- Remove leading/trailing underscores
  clean_name := trim(both '_' from clean_name);
  
  RETURN clean_name;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Create function to handle file uploads
CREATE OR REPLACE FUNCTION handle_file_upload()
RETURNS trigger AS $$
DECLARE
  path_parts text[];
  clean_filename text;
BEGIN
  -- Split path into parts
  path_parts := string_to_array(NEW.name, '/');
  
  -- Get and sanitize the filename (last part)
  clean_filename := sanitize_filename(path_parts[array_length(path_parts, 1)]);
  
  -- Reconstruct path with sanitized filename
  NEW.name := array_to_string(
    path_parts[1:array_length(path_parts, 1)-1] || ARRAY[clean_filename],
    '/'
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for file upload handling
DROP TRIGGER IF EXISTS handle_file_upload_trigger ON storage.objects;
CREATE TRIGGER handle_file_upload_trigger
  BEFORE INSERT ON storage.objects
  FOR EACH ROW
  EXECUTE FUNCTION handle_file_upload();

-- Update storage policies
DROP POLICY IF EXISTS "task_files_upload_policy" ON storage.objects;
DROP POLICY IF EXISTS "task_files_read_policy" ON storage.objects;
DROP POLICY IF EXISTS "task_files_delete_policy" ON storage.objects;

-- Create new storage policies
CREATE POLICY "task_attachments_upload_policy"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'task-attachments');

CREATE POLICY "task_attachments_read_policy"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'task-attachments');

CREATE POLICY "task_attachments_delete_policy"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'task-attachments');

-- Now safe to update tasks table
ALTER TABLE tasks
DROP COLUMN IF EXISTS files CASCADE;

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