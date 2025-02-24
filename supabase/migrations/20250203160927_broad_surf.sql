/*
  # Add assignee field to tasks

  1. Changes
    - Add assignee_id column to tasks table
    - Add foreign key constraint to auth.users
    - Update RLS policies to allow assigned users to view and update tasks

  2. Security
    - Maintain existing RLS policies
    - Add new policy for assigned users
*/

-- Add assignee_id column
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS assignee_id uuid REFERENCES auth.users(id);

-- Update RLS policies for tasks to include assignee access
DROP POLICY IF EXISTS "Users can view their own tasks" ON tasks;
CREATE POLICY "Users can view their own or assigned tasks"
  ON tasks
  FOR SELECT
  TO authenticated
  USING (owner_id = auth.uid() OR assignee_id = auth.uid());

DROP POLICY IF EXISTS "Users can update their own tasks" ON tasks;
CREATE POLICY "Users can update their own or assigned tasks"
  ON tasks
  FOR UPDATE
  TO authenticated
  USING (owner_id = auth.uid() OR assignee_id = auth.uid());