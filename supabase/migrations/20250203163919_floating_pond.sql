/*
  # Update task policies for drag and drop support

  1. Changes
    - Drop existing policies
    - Create new simplified policies that allow:
      - All authenticated users to view all tasks
      - Users to create their own tasks
      - All authenticated users to update task positions and statuses
      - Only owners can delete their tasks
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view all tasks" ON tasks;
DROP POLICY IF EXISTS "Users can create their own tasks" ON tasks;
DROP POLICY IF EXISTS "Users can update any task" ON tasks;
DROP POLICY IF EXISTS "Users can delete their own tasks" ON tasks;

-- Create simplified policies
CREATE POLICY "Users can view all tasks"
  ON tasks
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create their own tasks"
  ON tasks
  FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can update any task"
  ON tasks
  FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Users can delete their own tasks"
  ON tasks
  FOR DELETE
  TO authenticated
  USING (owner_id = auth.uid());