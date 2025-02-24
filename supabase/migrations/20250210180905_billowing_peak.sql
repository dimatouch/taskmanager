-- Drop existing functions
DROP FUNCTION IF EXISTS is_viewer_only(uuid, uuid);
DROP FUNCTION IF EXISTS get_viewer_only_tasks(uuid);

-- Create improved function to check if user is viewer only
CREATE OR REPLACE FUNCTION is_viewer_only(p_task_id uuid, p_user_id uuid)
RETURNS boolean AS $$
BEGIN
  -- A user is a viewer-only if they:
  -- 1. Have an explicit viewer role
  -- 2. Are NOT the owner
  -- 3. Are NOT the responsible person
  -- 4. Are NOT a co-worker
  RETURN EXISTS (
    SELECT 1 
    FROM task_roles tr
    JOIN tasks t ON t.id = tr.task_id
    WHERE tr.task_id = p_task_id 
    AND tr.user_id = p_user_id 
    AND tr.role = 'viewer'
    AND t.owner_id != p_user_id
    AND t.responsible_id != p_user_id
    AND NOT (p_user_id = ANY(t.coworkers))
  );
END;
$$ LANGUAGE plpgsql;

-- Create improved function to get viewer-only tasks
CREATE OR REPLACE FUNCTION get_viewer_only_tasks(p_user_id uuid)
RETURNS SETOF tasks AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT t.*
  FROM tasks t
  JOIN task_roles tr ON tr.task_id = t.id
  WHERE tr.user_id = p_user_id
  AND tr.role = 'viewer'
  AND t.owner_id != p_user_id
  AND t.responsible_id != p_user_id
  AND NOT (p_user_id = ANY(t.coworkers))
  ORDER BY t.created_at DESC;
END;
$$ LANGUAGE plpgsql;