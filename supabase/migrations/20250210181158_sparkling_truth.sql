-- Create function to handle viewer role assignments
CREATE OR REPLACE FUNCTION handle_viewer_role()
RETURNS trigger AS $$
BEGIN
  -- When a user is added as a viewer
  IF NEW.role = 'viewer' THEN
    -- Ensure they don't have other roles
    DELETE FROM task_roles
    WHERE task_id = NEW.task_id
    AND user_id = NEW.user_id
    AND role != 'viewer';
    
    -- Log activity
    INSERT INTO task_activities (
      task_id,
      user_id,
      type,
      field,
      new_value
    ) VALUES (
      NEW.task_id,
      NEW.user_id,
      'viewer',
      'viewers',
      'added'
    );
  END IF;

  -- When a user gets another role, remove viewer role
  IF NEW.role IN ('responsible', 'coworker') THEN
    DELETE FROM task_roles
    WHERE task_id = NEW.task_id
    AND user_id = NEW.user_id
    AND role = 'viewer';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for viewer role handling
CREATE TRIGGER handle_viewer_role_trigger
  AFTER INSERT OR UPDATE ON task_roles
  FOR EACH ROW
  EXECUTE FUNCTION handle_viewer_role();

-- Create function to get viewer-only tasks
CREATE OR REPLACE FUNCTION get_viewer_only_tasks(p_user_id uuid)
RETURNS SETOF tasks AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT t.*
  FROM tasks t
  JOIN task_roles tr ON tr.task_id = t.id
  WHERE tr.user_id = p_user_id
  AND tr.role = 'viewer'
  -- Ensure user is ONLY a viewer
  AND NOT EXISTS (
    SELECT 1 FROM task_roles tr2
    WHERE tr2.task_id = t.id
    AND tr2.user_id = p_user_id
    AND tr2.role != 'viewer'
  )
  -- And not owner/responsible/coworker
  AND t.owner_id != p_user_id
  AND t.responsible_id != p_user_id
  AND NOT (p_user_id = ANY(t.coworkers))
  ORDER BY t.created_at DESC;
END;
$$ LANGUAGE plpgsql;