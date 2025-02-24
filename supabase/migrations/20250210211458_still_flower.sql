-- Add task_id column to ideas table
ALTER TABLE ideas 
ADD COLUMN task_id uuid REFERENCES tasks(id) ON DELETE SET NULL;

-- Create index for better performance
CREATE INDEX ideas_task_id_idx ON ideas(task_id);

-- Update task_activities type check to include idea conversion
DO $$ 
BEGIN
  ALTER TABLE task_activities 
  DROP CONSTRAINT IF EXISTS task_activities_type_check;

  ALTER TABLE task_activities 
  ADD CONSTRAINT task_activities_type_check 
  CHECK (type IN ('update', 'create', 'delete', 'comment', 'progress', 'attachment', 'viewer', 'idea'));
END $$;