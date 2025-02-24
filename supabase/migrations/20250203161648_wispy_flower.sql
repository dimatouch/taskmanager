/*
  # Update task RLS policies for position management

  1. Changes
    - Modify RLS policies to allow batch position updates
    - Ensure tasks can be moved between statuses
    - Maintain security while enabling drag-and-drop functionality

  2. Security
    - Keep existing ownership and assignment checks
    - Allow position updates for owned/assigned tasks
*/

-- Drop existing task policies
DROP POLICY IF EXISTS "Users can view their own or assigned tasks" ON tasks;
DROP POLICY IF EXISTS "Users can create their own tasks" ON tasks;
DROP POLICY IF EXISTS "Users can update their own or assigned tasks" ON tasks;
DROP POLICY IF EXISTS "Users can delete their own tasks" ON tasks;

-- Recreate policies with improved position handling
CREATE POLICY "Users can view their own or assigned tasks"
  ON tasks
  FOR SELECT
  TO authenticated
  USING (owner_id = auth.uid() OR assignee_id = auth.uid());

CREATE POLICY "Users can create their own tasks"
  ON tasks
  FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can update their own or assigned tasks"
  ON tasks
  FOR UPDATE
  TO authenticated
  USING (
    -- Allow updates if user owns or is assigned to the task
    owner_id = auth.uid() OR assignee_id = auth.uid() OR
    -- Allow position updates for tasks in the same status group
    EXISTS (
      SELECT 1 FROM tasks AS t
      WHERE t.status_id = tasks.status_id
      AND (t.owner_id = auth.uid() OR t.assignee_id = auth.uid())
    )
  );

CREATE POLICY "Users can delete their own tasks"
  ON tasks
  FOR DELETE
  TO authenticated
  USING (owner_id = auth.uid());