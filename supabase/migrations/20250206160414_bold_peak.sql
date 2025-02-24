-- Drop existing policies
DROP POLICY IF EXISTS "Full access to tasks" ON tasks;
DROP POLICY IF EXISTS "Full access to task statuses" ON task_statuses;
DROP POLICY IF EXISTS "Full access to task assignees" ON task_assignees;
DROP POLICY IF EXISTS "Full access to task activities" ON task_activities;
DROP POLICY IF EXISTS "Full access to projects" ON projects;

-- Create new policies that allow anonymous access
CREATE POLICY "Anonymous access to tasks"
  ON tasks
  FOR ALL 
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anonymous access to task statuses"
  ON task_statuses
  FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anonymous access to task assignees"
  ON task_assignees
  FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anonymous access to task activities"
  ON task_activities
  FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anonymous access to projects"
  ON projects
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Update RLS to allow anonymous access
ALTER TABLE tasks FORCE ROW LEVEL SECURITY;
ALTER TABLE task_statuses FORCE ROW LEVEL SECURITY;
ALTER TABLE task_assignees FORCE ROW LEVEL SECURITY;
ALTER TABLE task_activities FORCE ROW LEVEL SECURITY;
ALTER TABLE projects FORCE ROW LEVEL SECURITY;