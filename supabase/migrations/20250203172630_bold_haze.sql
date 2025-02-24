/*
  # Add multiple assignees support

  1. New Tables
    - `task_assignees`
      - `task_id` (uuid, references tasks)
      - `user_id` (uuid, references auth.users)
      - `created_at` (timestamp)

  2. Changes
    - Remove single assignee_id from tasks table
    - Add new junction table for multiple assignees

  3. Security
    - Enable RLS on task_assignees
    - Add policies for viewing and managing assignees
*/

-- Create task_assignees junction table
CREATE TABLE task_assignees (
  task_id uuid REFERENCES tasks(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (task_id, user_id)
);

-- Copy existing assignees to the new table
INSERT INTO task_assignees (task_id, user_id)
SELECT id, assignee_id
FROM tasks
WHERE assignee_id IS NOT NULL;

-- Remove old assignee_id column
ALTER TABLE tasks DROP COLUMN assignee_id;

-- Enable RLS
ALTER TABLE task_assignees ENABLE ROW LEVEL SECURITY;

-- Policies for task_assignees
CREATE POLICY "assignees_select" ON task_assignees 
  FOR SELECT TO authenticated 
  USING (true);

CREATE POLICY "assignees_insert" ON task_assignees 
  FOR INSERT TO authenticated 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tasks 
      WHERE id = task_id AND owner_id = auth.uid()
    )
  );

CREATE POLICY "assignees_delete" ON task_assignees 
  FOR DELETE TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM tasks 
      WHERE id = task_id AND owner_id = auth.uid()
    )
  );