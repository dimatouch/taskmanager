-- Drop existing functions if they exist
DROP FUNCTION IF EXISTS get_responsible_tasks(uuid);
DROP FUNCTION IF EXISTS get_coworker_tasks(uuid);

-- Function to get tasks where user is responsible (first assignee)
CREATE OR REPLACE FUNCTION get_responsible_tasks(p_user_id uuid)
RETURNS TABLE (task_id uuid) AS $$
BEGIN
  RETURN QUERY
  WITH RankedAssignees AS (
    SELECT 
      ta.task_id,
      ta.user_id as assignee_id,
      ROW_NUMBER() OVER (PARTITION BY ta.task_id ORDER BY ta.created_at) as rn
    FROM task_assignees ta
  )
  SELECT ra.task_id
  FROM RankedAssignees ra
  WHERE ra.assignee_id = p_user_id
  AND ra.rn = 1;
END;
$$ LANGUAGE plpgsql;

-- Function to get tasks where user is a co-worker
CREATE OR REPLACE FUNCTION get_coworker_tasks(p_user_id uuid)
RETURNS TABLE (task_id uuid) AS $$
BEGIN
  RETURN QUERY
  WITH RankedAssignees AS (
    SELECT 
      ta.task_id,
      ta.user_id as assignee_id,
      ROW_NUMBER() OVER (PARTITION BY ta.task_id ORDER BY ta.created_at) as rn
    FROM task_assignees ta
  )
  SELECT DISTINCT ta.task_id
  FROM task_assignees ta
  WHERE ta.user_id = p_user_id
  AND ta.task_id NOT IN (
    SELECT ra.task_id
    FROM RankedAssignees ra
    WHERE ra.assignee_id = p_user_id
    AND ra.rn = 1
  );
END;
$$ LANGUAGE plpgsql;