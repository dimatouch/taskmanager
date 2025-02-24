-- Drop existing triggers and functions
DROP TRIGGER IF EXISTS cleanup_orphaned_records_trigger ON tasks;
DROP FUNCTION IF EXISTS cleanup_orphaned_records();

-- Drop existing tables to start fresh
DROP TABLE IF EXISTS task_assignees CASCADE;
DROP TABLE IF EXISTS task_activities CASCADE;

-- Recreate task_activities with proper constraints
CREATE TABLE task_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL,
  user_id uuid NOT NULL,
  type text NOT NULL,
  field text NOT NULL,
  old_value text,
  new_value text,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT task_activities_task_id_fkey 
    FOREIGN KEY (task_id) 
    REFERENCES tasks(id) 
    ON DELETE CASCADE
);

-- Create indexes for better performance
CREATE INDEX task_activities_task_id_idx ON task_activities(task_id);
CREATE INDEX task_activities_user_id_idx ON task_activities(user_id);
CREATE INDEX task_activities_created_at_idx ON task_activities(created_at DESC);

-- Enable RLS
ALTER TABLE task_activities ENABLE ROW LEVEL SECURITY;

-- Create policy for task_activities
CREATE POLICY "Full access to task activities"
  ON task_activities
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create function to log task changes
CREATE OR REPLACE FUNCTION log_task_changes()
RETURNS trigger AS $$
DECLARE
  v_user_id uuid;
BEGIN
  -- Get current user ID
  SELECT auth.uid() INTO v_user_id;
  IF v_user_id IS NULL THEN
    v_user_id := '00000000-0000-0000-0000-000000000001'::uuid;
  END IF;

  -- For new tasks
  IF TG_OP = 'INSERT' THEN
    INSERT INTO task_activities (task_id, user_id, type, field, new_value)
    VALUES (NEW.id, v_user_id, 'create', 'task', NEW.title);
    RETURN NEW;
  END IF;

  -- For deleted tasks
  IF TG_OP = 'DELETE' THEN
    -- No need to log deletion since the activity will be cascade deleted
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
        to_char(OLD.due_date, 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
        to_char(NEW.due_date, 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
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
DROP TRIGGER IF EXISTS log_task_changes_trigger ON tasks;
CREATE TRIGGER log_task_changes_trigger
  AFTER INSERT OR UPDATE OR DELETE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION log_task_changes();