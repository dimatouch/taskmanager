-- Create function to check if user is viewer only
CREATE OR REPLACE FUNCTION is_viewer_only(p_task_id uuid, p_user_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM task_roles 
    WHERE task_id = p_task_id 
    AND user_id = p_user_id 
    AND role = 'viewer'
  ) AND NOT EXISTS (
    SELECT 1 
    FROM tasks t
    WHERE t.id = p_task_id 
    AND (
      t.owner_id = p_user_id OR
      t.responsible_id = p_user_id OR
      p_user_id = ANY(t.coworkers)
    )
  );
END;
$$ LANGUAGE plpgsql;

-- Create function to get viewer-only tasks for a user
CREATE OR REPLACE FUNCTION get_viewer_only_tasks(p_user_id uuid)
RETURNS SETOF tasks AS $$
BEGIN
  RETURN QUERY
  SELECT t.*
  FROM tasks t
  JOIN task_roles tr ON tr.task_id = t.id
  WHERE tr.user_id = p_user_id
  AND tr.role = 'viewer'
  AND NOT EXISTS (
    SELECT 1
    FROM tasks t2
    WHERE t2.id = t.id
    AND (
      t2.owner_id = p_user_id OR
      t2.responsible_id = p_user_id OR
      p_user_id = ANY(t2.coworkers)
    )
  )
  ORDER BY t.created_at DESC;
END;
$$ LANGUAGE plpgsql;