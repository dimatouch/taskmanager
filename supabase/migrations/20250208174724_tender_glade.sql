-- Drop existing triggers
DROP TRIGGER IF EXISTS log_task_changes_trigger ON tasks;

-- Drop existing function
DROP FUNCTION IF EXISTS log_task_changes();

-- Create improved function to log task changes
CREATE OR REPLACE FUNCTION log_task_changes()
RETURNS trigger AS $$
DECLARE
  v_user_id uuid;
  v_old_date text;
  v_new_date text;
BEGIN
  -- Get current user ID
  SELECT auth.uid() INTO v_user_id;
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No authenticated user';
  END IF;

  -- Format dates for activity log
  v_old_date := CASE 
    WHEN OLD.due_date IS NOT NULL THEN 
      to_char(OLD.due_date, 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
    ELSE NULL 
  END;
  
  v_new_date := CASE 
    WHEN NEW.due_date IS NOT NULL THEN 
      to_char(NEW.due_date, 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
    ELSE NULL 
  END;

  -- For new tasks
  IF TG_OP = 'INSERT' THEN
    INSERT INTO task_activities (task_id, user_id, type, field, new_value)
    VALUES (NEW.id, v_user_id, 'create', 'task', NEW.title);
    RETURN NEW;
  END IF;

  -- For deleted tasks
  IF TG_OP = 'DELETE' THEN
    INSERT INTO task_activities (task_id, user_id, type, field, old_value)
    VALUES (OLD.id, v_user_id, 'delete', 'task', OLD.title);
    RETURN OLD;
  END IF;

  -- For updates
  IF TG_OP = 'UPDATE' THEN
    -- Title changes
    IF NEW.title IS DISTINCT FROM OLD.title THEN
      INSERT INTO task_activities (task_id, user_id, type, field, old_value, new_value)
      VALUES (NEW.id, v_user_id, 'update', 'title', OLD.title, NEW.title);
    END IF;

    -- Description changes
    IF NEW.description IS DISTINCT FROM OLD.description THEN
      INSERT INTO task_activities (task_id, user_id, type, field, old_value, new_value)
      VALUES (NEW.id, v_user_id, 'update', 'description', OLD.description, NEW.description);
    END IF;

    -- Status changes
    IF NEW.status_id IS DISTINCT FROM OLD.status_id THEN
      INSERT INTO task_activities (task_id, user_id, type, field, old_value, new_value)
      VALUES (NEW.id, v_user_id, 'update', 'status', OLD.status_id::text, NEW.status_id::text);
    END IF;

    -- Due date changes
    IF NEW.due_date IS DISTINCT FROM OLD.due_date THEN
      INSERT INTO task_activities (task_id, user_id, type, field, old_value, new_value)
      VALUES (
        NEW.id, 
        v_user_id, 
        'update', 
        'due_date',
        v_old_date,
        v_new_date
      );
    END IF;

    -- Project changes
    IF NEW.project_id IS DISTINCT FROM OLD.project_id THEN
      INSERT INTO task_activities (task_id, user_id, type, field, old_value, new_value)
      VALUES (NEW.id, v_user_id, 'update', 'project', OLD.project_id::text, NEW.project_id::text);
    END IF;

    -- Priority changes
    IF NEW.priority IS DISTINCT FROM OLD.priority THEN
      INSERT INTO task_activities (task_id, user_id, type, field, old_value, new_value)
      VALUES (NEW.id, v_user_id, 'update', 'priority', OLD.priority::text, NEW.priority::text);
    END IF;

    -- Result changes
    IF NEW.result IS DISTINCT FROM OLD.result THEN
      INSERT INTO task_activities (task_id, user_id, type, field, old_value, new_value)
      VALUES (NEW.id, v_user_id, 'update', 'result', OLD.result, NEW.result);
    END IF;

    -- Responsible changes
    IF NEW.responsible_id IS DISTINCT FROM OLD.responsible_id THEN
      INSERT INTO task_activities (task_id, user_id, type, field, old_value, new_value)
      VALUES (NEW.id, v_user_id, 'update', 'responsible', OLD.responsible_id::text, NEW.responsible_id::text);
    END IF;

    -- Coworkers changes
    IF NEW.coworkers IS DISTINCT FROM OLD.coworkers THEN
      INSERT INTO task_activities (task_id, user_id, type, field, old_value, new_value)
      VALUES (
        NEW.id, 
        v_user_id, 
        'update', 
        'co-workers',
        array_to_string(COALESCE(OLD.coworkers, ARRAY[]::uuid[]), ','),
        array_to_string(COALESCE(NEW.coworkers, ARRAY[]::uuid[]), ',')
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for task changes
CREATE TRIGGER log_task_changes_trigger
  AFTER INSERT OR UPDATE OR DELETE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION log_task_changes();