-- Drop existing triggers and functions first
DROP TRIGGER IF EXISTS validate_coworkers_trigger ON tasks;
DROP TRIGGER IF EXISTS ensure_single_responsible_trigger ON task_assignees;
DROP TRIGGER IF EXISTS log_assignee_changes_trigger ON task_assignees;
DROP FUNCTION IF EXISTS validate_coworkers();
DROP FUNCTION IF EXISTS ensure_single_responsible();
DROP FUNCTION IF EXISTS log_assignee_changes();

-- Add columns to tasks table if they don't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tasks' AND column_name = 'responsible_id'
  ) THEN
    ALTER TABLE tasks ADD COLUMN responsible_id uuid REFERENCES auth.users(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tasks' AND column_name = 'coworkers'
  ) THEN
    ALTER TABLE tasks ADD COLUMN coworkers uuid[] DEFAULT '{}';
  END IF;
END $$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS tasks_responsible_id_idx ON tasks(responsible_id);
CREATE INDEX IF NOT EXISTS tasks_coworkers_idx ON tasks USING gin(coworkers);

-- Migrate data from task_assignees to tasks
DO $$ 
DECLARE
  task_record RECORD;
  assignees RECORD;
BEGIN
  -- For each task
  FOR task_record IN SELECT id FROM tasks LOOP
    -- Get assignees ordered by creation date
    SELECT 
      array_agg(user_id ORDER BY created_at) as user_ids,
      array_agg(is_responsible ORDER BY created_at) as is_responsible
    INTO assignees
    FROM task_assignees
    WHERE task_id = task_record.id;

    IF assignees.user_ids IS NOT NULL AND array_length(assignees.user_ids, 1) > 0 THEN
      -- Update task with responsible and coworkers
      UPDATE tasks 
      SET 
        responsible_id = (
          SELECT user_id 
          FROM task_assignees 
          WHERE task_id = task_record.id 
          AND is_responsible = true 
          LIMIT 1
        ),
        coworkers = ARRAY(
          SELECT user_id 
          FROM task_assignees 
          WHERE task_id = task_record.id 
          AND is_responsible = false
        )
      WHERE id = task_record.id;
    END IF;
  END LOOP;
END $$;

-- Drop task_assignees table if it exists
DROP TABLE IF EXISTS task_assignees;

-- Update task activities to reflect new structure
UPDATE task_activities
SET field = 'responsible'
WHERE field = 'assignees' AND type = 'update';

-- Create function to validate coworkers array
CREATE OR REPLACE FUNCTION validate_coworkers()
RETURNS trigger AS $$
BEGIN
  -- Ensure responsible_id is not in coworkers
  IF NEW.responsible_id = ANY(NEW.coworkers) THEN
    NEW.coworkers = array_remove(NEW.coworkers, NEW.responsible_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for coworkers validation
CREATE TRIGGER validate_coworkers_trigger
  BEFORE INSERT OR UPDATE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION validate_coworkers();

-- Update task activities trigger
CREATE OR REPLACE FUNCTION log_task_changes()
RETURNS trigger AS $$
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

    -- Handle responsible_id changes
    IF NEW.responsible_id != OLD.responsible_id OR
       (NEW.responsible_id IS NULL AND OLD.responsible_id IS NOT NULL) OR
       (NEW.responsible_id IS NOT NULL AND OLD.responsible_id IS NULL) THEN
      INSERT INTO task_activities (task_id, user_id, type, field, old_value, new_value)
      VALUES (NEW.id, auth.uid(), 'update', 'responsible', OLD.responsible_id::text, NEW.responsible_id::text);
    END IF;

    -- Handle coworkers changes
    IF NEW.coworkers != OLD.coworkers THEN
      INSERT INTO task_activities (task_id, user_id, type, field, old_value, new_value)
      VALUES (NEW.id, auth.uid(), 'update', 'coworkers', array_to_string(OLD.coworkers, ','), array_to_string(NEW.coworkers, ','));
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