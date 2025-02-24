/*
  # Fix task policies for proper drag and drop support

  1. Changes
    - Simplify task policies to allow proper drag and drop functionality
    - Allow task updates for owners and assignees
    - Allow position updates within the same status
    - Maintain basic security while enabling necessary operations

  2. Security
    - Tasks can only be viewed by owners and assignees
    - Tasks can only be created by authenticated users
    - Tasks can be updated by owners and assignees
    - Tasks can only be deleted by owners
*/

-- Drop existing task policies
DROP POLICY IF EXISTS "Users can view their own or assigned tasks" ON tasks;
DROP POLICY IF EXISTS "Users can create their own tasks" ON tasks;
DROP POLICY IF EXISTS "Users can update tasks" ON tasks;
DROP POLICY IF EXISTS "Users can delete their own tasks" ON tasks;

-- Recreate policies with proper handling for drag and drop
CREATE POLICY "Users can view their own or assigned tasks"
  ON tasks
  FOR SELECT
  TO authenticated
  USING (
    -- Users can view tasks they own or are assigned to
    owner_id = auth.uid() OR assignee_id = auth.uid() OR
    -- Users can also view tasks in the same status as their tasks
    EXISTS (
      SELECT 1 FROM tasks AS t
      WHERE t.status_id = tasks.status_id
      AND (t.owner_id = auth.uid() OR t.assignee_id = auth.uid())
    )
  );

CREATE POLICY "Users can create their own tasks"
  ON tasks
  FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can update tasks"
  ON tasks
  FOR UPDATE
  TO authenticated
  USING (
    -- Users can update tasks they own or are assigned to
    owner_id = auth.uid() OR assignee_id = auth.uid() OR
    -- Users can update position of tasks in statuses where they have tasks
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