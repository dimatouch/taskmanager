-- Drop existing policies
DROP POLICY IF EXISTS "Full access to tasks" ON tasks;
DROP POLICY IF EXISTS "Company members can access tasks" ON tasks;

-- Create new policies for tasks
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

-- Create function to ensure company_id is set on task creation
CREATE OR REPLACE FUNCTION set_task_company_id()
RETURNS trigger AS $$
BEGIN
  -- Get user's current company
  SELECT current_company_id INTO NEW.company_id
  FROM user_profiles
  WHERE user_id = auth.uid();
  
  IF NEW.company_id IS NULL THEN
    RAISE EXCEPTION 'No current company selected';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to set company_id
DROP TRIGGER IF EXISTS set_task_company_id_trigger ON tasks;
CREATE TRIGGER set_task_company_id_trigger
  BEFORE INSERT ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION set_task_company_id();