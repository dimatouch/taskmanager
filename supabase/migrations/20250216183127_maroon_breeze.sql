-- Drop existing policies
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

  -- Ensure responsible_id is a member of the same company
  IF NEW.responsible_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM company_members
    WHERE company_id = NEW.company_id
    AND user_id = NEW.responsible_id
  ) THEN
    RAISE EXCEPTION 'Responsible user must be a company member';
  END IF;

  -- Ensure all coworkers are members of the same company
  IF NEW.coworkers IS NOT NULL AND array_length(NEW.coworkers, 1) > 0 AND EXISTS (
    SELECT unnest(NEW.coworkers) AS coworker_id
    EXCEPT
    SELECT user_id FROM company_members
    WHERE company_id = NEW.company_id
  ) THEN
    RAISE EXCEPTION 'All coworkers must be company members';
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