-- Drop existing policies first
DROP POLICY IF EXISTS "Full access to tasks" ON tasks;
DROP POLICY IF EXISTS "Company members can manage tasks" ON tasks;

-- Create maximally permissive policy for task management
CREATE POLICY "Full access to tasks"
  ON tasks
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create function to validate task assignments
CREATE OR REPLACE FUNCTION validate_task_assignments()
RETURNS trigger AS $$
DECLARE
  v_company_id uuid;
BEGIN
  -- Get company_id from user profile if not set
  IF NEW.company_id IS NULL THEN
    SELECT current_company_id INTO v_company_id
    FROM user_profiles
    WHERE user_id = auth.uid();
    
    NEW.company_id := v_company_id;
  END IF;

  -- Ensure company_id is set
  IF NEW.company_id IS NULL THEN
    RAISE EXCEPTION 'No company_id set for task';
  END IF;

  -- Remove responsible_id from coworkers if present
  IF NEW.responsible_id IS NOT NULL AND NEW.coworkers IS NOT NULL THEN
    NEW.coworkers = array_remove(NEW.coworkers, NEW.responsible_id);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for assignment validation
DROP TRIGGER IF EXISTS validate_task_assignments_trigger ON tasks;
CREATE TRIGGER validate_task_assignments_trigger
  BEFORE INSERT OR UPDATE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION validate_task_assignments();

-- Create maximally permissive policies for other tables
DROP POLICY IF EXISTS "Full access to company members" ON company_members;
CREATE POLICY "Full access to company members"
  ON company_members
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Full access to task activities" ON task_activities;
CREATE POLICY "Full access to task activities"
  ON task_activities
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Ensure all users have admin role
INSERT INTO user_roles (user_id, role, created_by, is_admin)
SELECT 
  id as user_id,
  'admin' as role,
  id as created_by,
  true as is_admin
FROM auth.users
WHERE NOT EXISTS (
  SELECT 1 FROM user_roles WHERE user_id = auth.users.id
);