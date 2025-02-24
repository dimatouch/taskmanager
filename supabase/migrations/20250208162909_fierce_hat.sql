/*
  # Update tasks table to include assignees

  1. Changes
    - Add responsible_id and coworkers columns to tasks table
    - Drop task_assignees table
    - Update existing tasks to preserve assignee data
    - Add indexes for better performance

  2. Security
    - Update RLS policies for new structure
*/

-- First, add new columns to tasks table
ALTER TABLE tasks
ADD COLUMN responsible_id uuid REFERENCES auth.users(id),
ADD COLUMN coworkers uuid[] DEFAULT '{}';

-- Create index for better performance
CREATE INDEX tasks_responsible_id_idx ON tasks(responsible_id);
CREATE INDEX tasks_coworkers_idx ON tasks USING gin(coworkers);

-- Migrate existing data
DO $$ 
DECLARE
  task_record RECORD;
  assignees RECORD;
BEGIN
  -- For each task
  FOR task_record IN SELECT id FROM tasks LOOP
    -- Get assignees ordered by creation date
    SELECT 
      array_agg(user_id ORDER BY created_at) as user_ids
    INTO assignees
    FROM task_assignees
    WHERE task_id = task_record.id;

    IF assignees.user_ids IS NOT NULL AND array_length(assignees.user_ids, 1) > 0 THEN
      -- Update task with responsible and coworkers
      UPDATE tasks 
      SET 
        responsible_id = assignees.user_ids[1],
        coworkers = array_remove(assignees.user_ids[2:array_length(assignees.user_ids, 1)], NULL)
      WHERE id = task_record.id;
    END IF;
  END LOOP;
END $$;

-- Drop task_assignees table
DROP TABLE task_assignees;

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

-- Update RLS policies
CREATE POLICY "Users can view tasks they are responsible for or co-working on"
  ON tasks
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = owner_id OR
    auth.uid() = responsible_id OR
    auth.uid() = ANY(coworkers)
  );

CREATE POLICY "Users can update tasks they are responsible for or co-working on"
  ON tasks
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = owner_id OR
    auth.uid() = responsible_id OR
    auth.uid() = ANY(coworkers)
  );