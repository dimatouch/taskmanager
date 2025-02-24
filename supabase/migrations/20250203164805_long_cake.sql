/*
  # Task Management System

  1. Tables
    - task_statuses: Predefined task statuses
    - tasks: User tasks with status and position tracking

  2. Security
    - Enable RLS on all tables
    - Policies for authenticated users
    - Proper position handling for drag and drop
*/

-- Reset existing tables
DROP TABLE IF EXISTS tasks;
DROP TABLE IF EXISTS task_statuses;

-- Create task_statuses table
CREATE TABLE task_statuses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  color text NOT NULL,
  position integer NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create tasks table
CREATE TABLE tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  status_id uuid REFERENCES task_statuses(id) ON DELETE CASCADE NOT NULL,
  position integer NOT NULL,
  due_date timestamptz,
  owner_id uuid REFERENCES auth.users(id) NOT NULL,
  assignee_id uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE task_statuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- Insert default statuses
INSERT INTO task_statuses (name, color, position) VALUES
  ('To Do', '#E5E7EB', 1),
  ('In Progress', '#FDE68A', 2),
  ('Review', '#93C5FD', 3),
  ('Done', '#BBF7D0', 4);

-- Policies for task_statuses
CREATE POLICY "Everyone can view task statuses"
  ON task_statuses
  FOR SELECT
  TO authenticated
  USING (true);

-- Policies for tasks
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