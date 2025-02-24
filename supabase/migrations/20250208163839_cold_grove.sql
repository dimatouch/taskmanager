/*
  # Set up task activity logging
  
  1. Create trigger function to log task changes
  2. Create trigger to automatically log changes
*/

-- Create function to log task changes
CREATE OR REPLACE FUNCTION log_task_changes()
RETURNS trigger AS $$
DECLARE
  field_name text;
  old_value text;
  new_value text;
BEGIN
  -- Check if this is an update
  IF TG_OP = 'UPDATE' THEN
    -- Check each field for changes
    IF NEW.title != OLD.title THEN
      INSERT INTO task_activities (task_id, user_id, type, field, old_value, new_value)
      VALUES (NEW.id, auth.uid(), 'update', 'title', OLD.title, NEW.title);
    END IF;

    IF NEW.description != OLD.description OR 
       (NEW.description IS NULL AND OLD.description IS NOT NULL) OR
       (NEW.description IS NOT NULL AND OLD.description IS NULL) THEN
      INSERT INTO task_activities (task_id, user_id, type, field, old_value, new_value)
      VALUES (NEW.id, auth.uid(), 'update', 'description', OLD.description, NEW.description);
    END IF;

    IF NEW.status_id != OLD.status_id THEN
      INSERT INTO task_activities (task_id, user_id, type, field, old_value, new_value)
      VALUES (NEW.id, auth.uid(), 'update', 'status', OLD.status_id::text, NEW.status_id::text);
    END IF;

    IF NEW.due_date != OLD.due_date OR
       (NEW.due_date IS NULL AND OLD.due_date IS NOT NULL) OR
       (NEW.due_date IS NOT NULL AND OLD.due_date IS NULL) THEN
      INSERT INTO task_activities (task_id, user_id, type, field, old_value, new_value)
      VALUES (
        NEW.id, 
        auth.uid(), 
        'update', 
        'due_date',
        CASE WHEN OLD.due_date IS NOT NULL 
          THEN to_char(OLD.due_date, 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
          ELSE NULL 
        END,
        CASE WHEN NEW.due_date IS NOT NULL 
          THEN to_char(NEW.due_date, 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
          ELSE NULL 
        END
      );
    END IF;

    IF NEW.project_id != OLD.project_id OR
       (NEW.project_id IS NULL AND OLD.project_id IS NOT NULL) OR
       (NEW.project_id IS NOT NULL AND OLD.project_id IS NULL) THEN
      INSERT INTO task_activities (task_id, user_id, type, field, old_value, new_value)
      VALUES (NEW.id, auth.uid(), 'update', 'project', OLD.project_id::text, NEW.project_id::text);
    END IF;

    IF NEW.priority != OLD.priority THEN
      INSERT INTO task_activities (task_id, user_id, type, field, old_value, new_value)
      VALUES (NEW.id, auth.uid(), 'update', 'priority', OLD.priority::text, NEW.priority::text);
    END IF;

    IF NEW.result != OLD.result OR
       (NEW.result IS NULL AND OLD.result IS NOT NULL) OR
       (NEW.result IS NOT NULL AND OLD.result IS NULL) THEN
      INSERT INTO task_activities (task_id, user_id, type, field, old_value, new_value)
      VALUES (NEW.id, auth.uid(), 'update', 'result', OLD.result, NEW.result);
    END IF;
  END IF;

  -- For new tasks
  IF TG_OP = 'INSERT' THEN
    INSERT INTO task_activities (task_id, user_id, type, field, new_value)
    VALUES (NEW.id, auth.uid(), 'create', 'task', NEW.title);
  END IF;

  -- For deleted tasks
  IF TG_OP = 'DELETE' THEN
    INSERT INTO task_activities (task_id, user_id, type, field, old_value)
    VALUES (OLD.id, auth.uid(), 'delete', 'task', OLD.title);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for task changes
DROP TRIGGER IF EXISTS log_task_changes_trigger ON tasks;
CREATE TRIGGER log_task_changes_trigger
  AFTER INSERT OR UPDATE OR DELETE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION log_task_changes();

-- Create function to log assignee changes
CREATE OR REPLACE FUNCTION log_assignee_changes()
RETURNS trigger AS $$
BEGIN
  -- For new assignees
  IF TG_OP = 'INSERT' THEN
    INSERT INTO task_activities (task_id, user_id, type, field, new_value)
    VALUES (
      NEW.task_id,
      auth.uid(),
      'update',
      CASE WHEN NEW.is_responsible THEN 'responsible' ELSE 'coworkers' END,
      NEW.user_id::text
    );
  END IF;

  -- For removed assignees
  IF TG_OP = 'DELETE' THEN
    INSERT INTO task_activities (task_id, user_id, type, field, old_value)
    VALUES (
      OLD.task_id,
      auth.uid(),
      'update',
      CASE WHEN OLD.is_responsible THEN 'responsible' ELSE 'coworkers' END,
      OLD.user_id::text
    );
  END IF;

  -- For updated assignees
  IF TG_OP = 'UPDATE' THEN
    IF NEW.is_responsible != OLD.is_responsible THEN
      INSERT INTO task_activities (task_id, user_id, type, field, old_value, new_value)
      VALUES (
        NEW.task_id,
        auth.uid(),
        'update',
        'responsible',
        CASE WHEN OLD.is_responsible THEN OLD.user_id::text ELSE NULL END,
        CASE WHEN NEW.is_responsible THEN NEW.user_id::text ELSE NULL END
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for assignee changes
DROP TRIGGER IF EXISTS log_assignee_changes_trigger ON task_assignees;
CREATE TRIGGER log_assignee_changes_trigger
  AFTER INSERT OR UPDATE OR DELETE ON task_assignees
  FOR EACH ROW
  EXECUTE FUNCTION log_assignee_changes();