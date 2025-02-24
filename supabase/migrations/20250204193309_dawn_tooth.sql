/*
  # Add task filtering functions
  
  1. New Functions
    - get_responsible_tasks: Returns tasks where user is the first assignee
    - get_coworker_tasks: Returns tasks where user is a co-worker (not first assignee)
*/

-- Function to get tasks where user is responsible (first assignee)
CREATE OR REPLACE FUNCTION get_responsible_tasks(user_id uuid)
RETURNS TABLE (task_id uuid) AS $$
BEGIN
  RETURN QUERY
  WITH RankedAssignees AS (
    SELECT 
      task_id,
      user_id as assignee_id,
      ROW_NUMBER() OVER (PARTITION BY task_id ORDER BY created_at) as rn
    FROM task_assignees
  )
  SELECT ra.task_id
  FROM RankedAssignees ra
  WHERE ra.assignee_id = user_id
  AND ra.rn = 1;
END;
$$ LANGUAGE plpgsql;

-- Function to get tasks where user is a co-worker
CREATE OR REPLACE FUNCTION get_coworker_tasks(user_id uuid)
RETURNS TABLE (task_id uuid) AS $$
BEGIN
  RETURN QUERY
  WITH RankedAssignees AS (
    SELECT 
      task_id,
      user_id as assignee_id,
      ROW_NUMBER() OVER (PARTITION BY task_id ORDER BY created_at) as rn
    FROM task_assignees
  )
  SELECT DISTINCT ta.task_id
  FROM task_assignees ta
  WHERE ta.user_id = user_id
  AND ta.task_id NOT IN (
    SELECT ra.task_id
    FROM RankedAssignees ra
    WHERE ra.assignee_id = user_id
    AND ra.rn = 1
  );
END;
$$ LANGUAGE plpgsql;