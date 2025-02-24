/*
  # Fix task assignees table and policies

  1. Changes
    - Drop existing task_assignees table and recreate it with proper constraints
    - Add test users to auth.users table
    - Update policies to allow proper access
*/

-- First, drop the existing table and its policies
DROP TABLE IF EXISTS task_assignees;

-- Create task_assignees table with proper constraints
CREATE TABLE task_assignees (
  task_id uuid REFERENCES tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (task_id, user_id)
);

-- Enable RLS
ALTER TABLE task_assignees ENABLE ROW LEVEL SECURITY;

-- Create policies for task_assignees
CREATE POLICY "assignees_select"
  ON task_assignees
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "assignees_insert"
  ON task_assignees
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tasks
      WHERE id = task_id AND owner_id = auth.uid()
    )
  );

CREATE POLICY "assignees_delete"
  ON task_assignees
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tasks
      WHERE id = task_id AND owner_id = auth.uid()
    )
  );

-- Insert test users if they don't exist
INSERT INTO auth.users (id, email)
VALUES 
  ('00000000-0000-0000-0000-000000000001', 'max@example.com'),
  ('00000000-0000-0000-0000-000000000002', 'polya@example.com'),
  ('00000000-0000-0000-0000-000000000003', 'dima@example.com')
ON CONFLICT (id) DO NOTHING;