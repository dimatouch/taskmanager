/*
  # Fix recursive RLS policies

  1. Changes
    - Remove recursive table references that caused infinite recursion
    - Simplify policies while maintaining security
    - Enable proper drag and drop functionality
    - Fix task viewing and updating permissions

  2. Security
    - Tasks can be viewed by owners and assignees
    - Tasks can only be created by authenticated users
    - Tasks can be updated by owners and assignees
    - Tasks can only be deleted by owners
*/

-- Drop existing task policies
DROP POLICY IF EXISTS "Users can view their own or assigned tasks" ON tasks;
DROP POLICY IF EXISTS "Users can create their own tasks" ON tasks;
DROP POLICY IF EXISTS "Users can update tasks" ON tasks;
DROP POLICY IF EXISTS "Users can delete their own tasks" ON tasks;

-- Recreate policies without recursion
CREATE POLICY "Users can view their own or assigned tasks"
  ON tasks
  FOR SELECT
  TO authenticated
  USING (
    owner_id = auth.uid() OR 
    assignee_id = auth.uid()
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
    owner_id = auth.uid() OR 
    assignee_id = auth.uid()
  );

CREATE POLICY "Users can delete their own tasks"
  ON tasks
  FOR DELETE
  TO authenticated
  USING (owner_id = auth.uid());