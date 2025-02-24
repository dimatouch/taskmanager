-- First clean up any orphaned records
DELETE FROM task_activities 
WHERE task_id NOT IN (SELECT id FROM tasks);

-- Recreate task_assignees table
CREATE TABLE IF NOT EXISTS task_assignees (
  task_id uuid REFERENCES tasks(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (task_id, user_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS task_assignees_task_id_idx ON task_assignees(task_id);
CREATE INDEX IF NOT EXISTS task_assignees_user_id_idx ON task_assignees(user_id);

-- Enable RLS
ALTER TABLE task_assignees ENABLE ROW LEVEL SECURITY;

-- Create policy for task_assignees
CREATE POLICY "Full access to task assignees"
  ON task_assignees
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Migrate data from tasks to task_assignees
INSERT INTO task_assignees (task_id, user_id)
SELECT DISTINCT t.id, unnest(array_append(t.coworkers, t.responsible_id))
FROM tasks t
WHERE t.responsible_id IS NOT NULL OR array_length(t.coworkers, 1) > 0
ON CONFLICT DO NOTHING;

-- Add ON DELETE CASCADE to task_activities
ALTER TABLE task_activities 
DROP CONSTRAINT IF EXISTS task_activities_task_id_fkey,
ADD CONSTRAINT task_activities_task_id_fkey 
  FOREIGN KEY (task_id) 
  REFERENCES tasks(id) 
  ON DELETE CASCADE;