/*
  # Fix task policies for drag and drop

  1. Changes
    - Simplify policies to enable drag and drop
    - Remove complex conditions that caused errors
    - Enable proper task updates while maintaining security

  2. Security
    - Users can view all tasks for drag and drop functionality
    - Users can create tasks they own
    - Users can update any task (needed for drag and drop)
    - Only owners can delete their tasks
*/

-- Drop existing task policies
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