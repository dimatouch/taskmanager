/*
  # Update task RLS policies

  1. Changes
    - Update task policies to allow proper position management
    - Allow users to update positions of tasks they own or are assigned to
    - Ensure task creation works with position field

  2. Security
    - Maintain security by checking owner_id and assignee_id
    - Keep existing view and delete restrictions
*/

-- Drop existing task policies
DROP POLICY IF EXISTS "Users can view their own or assigned tasks" ON tasks;
DROP POLICY IF EXISTS "Users can create their own tasks" ON tasks;
DROP POLICY IF EXISTS "Users can update their own or assigned tasks" ON tasks;
DROP POLICY IF EXISTS "Users can delete their own tasks" ON tasks;

-- Recreate policies with proper position handling
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
  USING (owner_id = auth.uid() OR assignee_id = auth.uid());

CREATE POLICY "Users can delete their own tasks"
  ON tasks
  FOR DELETE
  TO authenticated
  USING (owner_id = auth.uid());