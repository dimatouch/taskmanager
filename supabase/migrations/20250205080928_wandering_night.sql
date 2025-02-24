/*
  # Add subtask support
  
  1. New Columns
    - Add parent_id and is_subtask columns to tasks table
    - Add index for better performance
  
  2. Functions
    - Add function to get all subtasks for a task
*/

-- Add parent_id column to tasks table
ALTER TABLE tasks 
ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES tasks(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS is_subtask boolean NOT NULL DEFAULT false;

-- Add index for better performance
CREATE INDEX IF NOT EXISTS tasks_parent_id_idx ON tasks(parent_id);

-- Create function to get all subtasks for a task
CREATE OR REPLACE FUNCTION get_task_subtasks(p_task_id uuid)
RETURNS SETOF tasks AS $$
WITH RECURSIVE task_tree AS (
  -- Base case: direct subtasks
  SELECT 
    t.*,
    1 as level
  FROM tasks t
  WHERE t.parent_id = p_task_id
  
  UNION ALL
  
  -- Recursive case: subtasks of subtasks
  SELECT 
    t.*,
    tt.level + 1
  FROM tasks t
  INNER JOIN task_tree tt ON t.parent_id = tt.id
)
SELECT 
  id, title, description, status_id, position, due_date,
  owner_id, created_at, updated_at, project_id, result,
  parent_id, is_subtask
FROM task_tree
ORDER BY level, position;
$$ LANGUAGE sql;