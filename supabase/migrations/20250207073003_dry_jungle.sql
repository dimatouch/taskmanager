-- Drop existing policies
DROP POLICY IF EXISTS "Full access to tasks" ON tasks;

-- Create new RLS policies for tasks
CREATE POLICY "Users can create tasks"
  ON tasks
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Allow authenticated users to create tasks
    -- and set themselves as owner
    auth.uid() = owner_id
  );

CREATE POLICY "Users can view tasks"
  ON tasks
  FOR SELECT
  TO authenticated
  USING (
    -- Users can view tasks they own
    owner_id = auth.uid() OR
    -- Or tasks they are assigned to
    EXISTS (
      SELECT 1 FROM task_assignees
      WHERE task_id = tasks.id
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their tasks"
  ON tasks
  FOR UPDATE
  TO authenticated
  USING (
    -- Users can update tasks they own
    owner_id = auth.uid() OR
    -- Or tasks they are assigned to
    EXISTS (
      SELECT 1 FROM task_assignees
      WHERE task_id = tasks.id
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their tasks"
  ON tasks
  FOR DELETE
  TO authenticated
  USING (owner_id = auth.uid());

-- Ensure RLS is enabled
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;