-- Drop existing policies
DROP POLICY IF EXISTS "Full access to tasks" ON tasks;

-- Drop existing triggers
DROP TRIGGER IF EXISTS validate_coworkers_trigger ON tasks;
DROP TRIGGER IF EXISTS log_task_changes_trigger ON tasks;

-- Drop existing functions
DROP FUNCTION IF EXISTS validate_coworkers();
DROP FUNCTION IF EXISTS log_task_changes();

-- Recreate coworkers column with proper type
ALTER TABLE tasks 
DROP COLUMN IF EXISTS coworkers CASCADE;

ALTER TABLE tasks
ADD COLUMN coworkers uuid[] DEFAULT ARRAY[]::uuid[];

-- Create function to validate coworkers array
CREATE OR REPLACE FUNCTION validate_coworkers()
RETURNS trigger AS $$
BEGIN
  -- Ensure coworkers is never null
  IF NEW.coworkers IS NULL THEN
    NEW.coworkers := ARRAY[]::uuid[];
  END IF;
  
  -- Ensure responsible_id is not in coworkers
  IF NEW.responsible_id = ANY(NEW.coworkers) THEN
    NEW.coworkers := array_remove(NEW.coworkers, NEW.responsible_id);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for coworkers validation
CREATE TRIGGER validate_coworkers_trigger
  BEFORE INSERT OR UPDATE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION validate_coworkers();

-- Create function to log task changes
CREATE OR REPLACE FUNCTION log_task_changes()
RETURNS trigger AS $$
DECLARE
  v_user_id uuid;
BEGIN
  -- Get current user ID
  SELECT auth.uid() INTO v_user_id;
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No authenticated user';
  END IF;

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
        OLD.due_date::text,
        NEW.due_date::text
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

-- Create new permissive policy
CREATE POLICY "Full access to tasks"
  ON tasks
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);