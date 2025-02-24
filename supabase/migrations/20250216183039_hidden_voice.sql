-- Drop existing policies
DROP POLICY IF EXISTS "Company members can manage tasks" ON tasks;

-- Create more permissive policy for task management
CREATE POLICY "Company members can manage tasks"
  ON tasks
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN company_members cm ON cm.company_id = up.current_company_id
      WHERE cm.user_id = auth.uid()
      AND up.current_company_id = tasks.company_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles up
      JOIN company_members cm ON cm.company_id = up.current_company_id
      WHERE cm.user_id = auth.uid()
      AND up.current_company_id = tasks.company_id
    )
  );

-- Create function to validate task assignments
CREATE OR REPLACE FUNCTION validate_task_assignments()
RETURNS trigger AS $$
BEGIN
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
  BEFORE INSERT OR UPDATE OF responsible_id, coworkers ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION validate_task_assignments();