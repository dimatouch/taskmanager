-- Drop existing policies
DROP POLICY IF EXISTS "Users can create tasks" ON tasks;
DROP POLICY IF EXISTS "Users can view tasks" ON tasks;
DROP POLICY IF EXISTS "Users can update their tasks" ON tasks;
DROP POLICY IF EXISTS "Users can delete their tasks" ON tasks;
DROP POLICY IF EXISTS "Full access to task statuses" ON task_statuses;
DROP POLICY IF EXISTS "Full access to task assignees" ON task_assignees;
DROP POLICY IF EXISTS "Full access to task activities" ON task_activities;

-- Create simplified permissive policies
CREATE POLICY "Full access to tasks"
  ON tasks
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Full access to task statuses"
  ON task_statuses
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Full access to task assignees"
  ON task_assignees
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Full access to task activities"
  ON task_activities
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Ensure RLS is enabled on all tables
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_statuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_assignees ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_activities ENABLE ROW LEVEL SECURITY;

-- Insert default statuses if they don't exist
INSERT INTO task_statuses (name, color, position)
SELECT 'To Do', '#6366F1', 1
WHERE NOT EXISTS (SELECT 1 FROM task_statuses WHERE name = 'To Do');

INSERT INTO task_statuses (name, color, position)
SELECT 'In Progress', '#F59E0B', 2
WHERE NOT EXISTS (SELECT 1 FROM task_statuses WHERE name = 'In Progress');

INSERT INTO task_statuses (name, color, position)
SELECT 'Review', '#8B5CF6', 3
WHERE NOT EXISTS (SELECT 1 FROM task_statuses WHERE name = 'Review');

INSERT INTO task_statuses (name, color, position)
SELECT 'Done', '#10B981', 4
WHERE NOT EXISTS (SELECT 1 FROM task_statuses WHERE name = 'Done');