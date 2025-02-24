/*
  # Add viewers role to task roles

  1. Changes
    - Add 'viewer' as a valid role in task_roles table
    - Update functions to handle viewers
    - Add helper function to get task viewers

  2. Security
    - Maintain existing RLS policies
    - Viewers can only view tasks, not modify them
*/

-- Update role check constraint to include viewer role
ALTER TABLE task_roles 
DROP CONSTRAINT IF EXISTS task_roles_role_check;

ALTER TABLE task_roles 
ADD CONSTRAINT task_roles_role_check 
CHECK (role IN ('responsible', 'coworker', 'viewer'));

-- Create function to get task viewers
CREATE OR REPLACE FUNCTION get_task_viewers(p_task_id uuid)
RETURNS SETOF uuid AS $$
  SELECT user_id
  FROM task_roles
  WHERE task_id = p_task_id
  AND role = 'viewer'
  ORDER BY created_at;
$$ LANGUAGE sql;

-- Update ensure_single_responsible function to handle viewers
CREATE OR REPLACE FUNCTION ensure_single_responsible()
RETURNS trigger AS $$
BEGIN
  -- Only enforce single responsible if the role is 'responsible'
  IF NEW.role = 'responsible' THEN
    -- Set any existing responsible user to coworker
    UPDATE task_roles
    SET role = 'coworker'
    WHERE task_id = NEW.task_id
    AND role = 'responsible'
    AND user_id != NEW.user_id;
  END IF;

  -- Ensure user doesn't have multiple roles
  DELETE FROM task_roles
  WHERE task_id = NEW.task_id
  AND user_id = NEW.user_id
  AND role != NEW.role;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Update task_activities type check to include viewer changes
DO $$ 
BEGIN
  -- Add 'viewer' to valid activity types if not already present
  ALTER TABLE task_activities 
  DROP CONSTRAINT IF EXISTS task_activities_type_check;

  ALTER TABLE task_activities 
  ADD CONSTRAINT task_activities_type_check 
  CHECK (type IN ('update', 'create', 'delete', 'comment', 'progress', 'attachment', 'viewer'));
END $$;