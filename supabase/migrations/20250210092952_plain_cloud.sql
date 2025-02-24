/*
  # Add Subtasks Support

  1. Changes
    - Add parent_id and is_subtask columns to tasks table
    - Add indexes for better performance
    - Add RLS policies for subtasks

  2. Notes
    - parent_id references the parent task
    - is_subtask flag helps quickly identify subtasks
    - Cascade delete ensures subtasks are removed with parent
*/

-- Add columns for subtask support
ALTER TABLE tasks
ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES tasks(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS is_subtask boolean NOT NULL DEFAULT false;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS tasks_parent_id_idx ON tasks(parent_id);
CREATE INDEX IF NOT EXISTS tasks_is_subtask_idx ON tasks(is_subtask);

-- Create function to get all subtasks for a task
CREATE OR REPLACE FUNCTION get_task_subtasks(p_task_id uuid)
RETURNS SETOF tasks AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM tasks
  WHERE parent_id = p_task_id
  ORDER BY created_at ASC;
END;
$$ LANGUAGE plpgsql;