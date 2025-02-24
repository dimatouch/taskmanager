-- First, drop existing foreign key constraints
ALTER TABLE task_activities 
DROP CONSTRAINT IF EXISTS task_activities_task_id_fkey;

ALTER TABLE task_assignees
DROP CONSTRAINT IF EXISTS task_assignees_task_id_fkey;

-- Clean up orphaned records
DELETE FROM task_activities 
WHERE task_id NOT IN (SELECT id FROM tasks);

DELETE FROM task_assignees 
WHERE task_id NOT IN (SELECT id FROM tasks);

-- Recreate foreign key constraints with CASCADE
ALTER TABLE task_activities
ADD CONSTRAINT task_activities_task_id_fkey 
  FOREIGN KEY (task_id) 
  REFERENCES tasks(id) 
  ON DELETE CASCADE;

ALTER TABLE task_assignees
ADD CONSTRAINT task_assignees_task_id_fkey 
  FOREIGN KEY (task_id) 
  REFERENCES tasks(id) 
  ON DELETE CASCADE;

-- Create function to clean up orphaned records
CREATE OR REPLACE FUNCTION cleanup_orphaned_records()
RETURNS trigger AS $$
BEGIN
  -- Clean up task_activities
  DELETE FROM task_activities 
  WHERE task_id NOT IN (SELECT id FROM tasks);
  
  -- Clean up task_assignees
  DELETE FROM task_assignees 
  WHERE task_id NOT IN (SELECT id FROM tasks);
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically clean up orphaned records
DROP TRIGGER IF EXISTS cleanup_orphaned_records_trigger ON tasks;
CREATE TRIGGER cleanup_orphaned_records_trigger
  AFTER DELETE ON tasks
  FOR EACH STATEMENT
  EXECUTE FUNCTION cleanup_orphaned_records();