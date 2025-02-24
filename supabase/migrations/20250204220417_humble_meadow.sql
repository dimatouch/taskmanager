-- Drop existing functions
DROP FUNCTION IF EXISTS get_responsible_tasks(uuid);
DROP FUNCTION IF EXISTS get_coworker_tasks(uuid);

-- Create function to get tasks where user is responsible
CREATE OR REPLACE FUNCTION get_responsible_tasks(p_user_id uuid)
RETURNS TABLE (
  task_id uuid,
  task_position integer
) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT t.id, t.position
  FROM tasks t
  INNER JOIN task_assignees ta ON t.id = ta.task_id
  WHERE ta.user_id = p_user_id
  AND ta.task_id IN (
    SELECT a.task_id
    FROM task_assignees a
    WHERE a.user_id = p_user_id
    GROUP BY a.task_id
    HAVING MIN(a.created_at) = MIN(ta.created_at)
  )
  ORDER BY t.position;
END;
$$ LANGUAGE plpgsql;

-- Create function to get tasks where user is a co-worker
CREATE OR REPLACE FUNCTION get_coworker_tasks(p_user_id uuid)
RETURNS TABLE (
  task_id uuid,
  task_position integer
) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT t.id, t.position
  FROM tasks t
  INNER JOIN task_assignees ta ON t.id = ta.task_id
  WHERE ta.user_id = p_user_id
  AND ta.task_id NOT IN (
    SELECT a.task_id
    FROM task_assignees a
    WHERE a.user_id = p_user_id
    GROUP BY a.task_id
    HAVING MIN(a.created_at) = MIN(ta.created_at)
  )
  ORDER BY t.position;
END;
$$ LANGUAGE plpgsql;