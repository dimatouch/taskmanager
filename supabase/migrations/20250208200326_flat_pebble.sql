-- Add project_id column to tasks table if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tasks' AND column_name = 'project_id'
  ) THEN
    ALTER TABLE tasks ADD COLUMN project_id uuid REFERENCES projects(id);
  END IF;
END $$;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS tasks_project_id_idx ON tasks(project_id);

-- Update task activities type check to include project changes
DO $$ 
BEGIN
  ALTER TABLE task_activities 
  DROP CONSTRAINT IF EXISTS task_activities_type_check;

  ALTER TABLE task_activities 
  ADD CONSTRAINT task_activities_type_check 
  CHECK (type IN ('update', 'create', 'delete', 'comment', 'progress'));
END $$;