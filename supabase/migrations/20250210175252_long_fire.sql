/*
  # Add viewer tracking

  1. Changes
    - Add viewer_count column to tasks
    - Add trigger to update viewer count
    - Add function to log viewer changes

  2. Security
    - Maintain existing RLS policies
*/

-- Add viewer_count to tasks
ALTER TABLE tasks
ADD COLUMN viewer_count integer DEFAULT 0;

-- Create function to update viewer count
CREATE OR REPLACE FUNCTION update_viewer_count()
RETURNS trigger AS $$
DECLARE
  new_count integer;
BEGIN
  -- Calculate new viewer count
  SELECT COUNT(*)
  INTO new_count
  FROM task_roles
  WHERE task_id = COALESCE(NEW.task_id, OLD.task_id)
  AND role = 'viewer';

  -- Update viewer count for the task
  UPDATE tasks
  SET viewer_count = new_count
  WHERE id = COALESCE(NEW.task_id, OLD.task_id);

  -- Log viewer change activity
  INSERT INTO task_activities (
    task_id,
    user_id,
    type,
    field,
    old_value,
    new_value
  )
  VALUES (
    COALESCE(NEW.task_id, OLD.task_id),
    COALESCE(NEW.user_id, OLD.user_id),
    'viewer',
    'viewers',
    (new_count - 1)::text,
    new_count::text
  );

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create separate triggers for INSERT and DELETE
CREATE TRIGGER update_viewer_count_on_insert
  AFTER INSERT ON task_roles
  FOR EACH ROW
  WHEN (NEW.role = 'viewer')
  EXECUTE FUNCTION update_viewer_count();

CREATE TRIGGER update_viewer_count_on_delete
  AFTER DELETE ON task_roles
  FOR EACH ROW
  WHEN (OLD.role = 'viewer')
  EXECUTE FUNCTION update_viewer_count();