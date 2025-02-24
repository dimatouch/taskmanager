-- Drop existing policies
DROP POLICY IF EXISTS "Full access to tasks" ON tasks;
DROP POLICY IF EXISTS "Full access to task statuses" ON task_statuses;
DROP POLICY IF EXISTS "Full access to task activities" ON task_activities;

-- Create improved policies for tasks
CREATE POLICY "Company members can access tasks"
  ON tasks
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM company_members cm
      JOIN user_profiles up ON up.current_company_id = cm.company_id
      WHERE cm.user_id = auth.uid()
      AND tasks.company_id = cm.company_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM company_members cm
      JOIN user_profiles up ON up.current_company_id = cm.company_id
      WHERE cm.user_id = auth.uid()
      AND tasks.company_id = cm.company_id
    )
  );

-- Create policies for task statuses
CREATE POLICY "Company members can access task statuses"
  ON task_statuses
  FOR ALL
  TO authenticated
  USING (
    company_id IS NULL OR
    EXISTS (
      SELECT 1 FROM company_members cm
      JOIN user_profiles up ON up.current_company_id = cm.company_id
      WHERE cm.user_id = auth.uid()
      AND task_statuses.company_id = cm.company_id
    )
  );

-- Create policies for task activities
CREATE POLICY "Company members can access task activities"
  ON task_activities
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tasks t
      JOIN company_members cm ON cm.company_id = t.company_id
      JOIN user_profiles up ON up.current_company_id = cm.company_id
      WHERE cm.user_id = auth.uid()
      AND t.id = task_activities.task_id
    )
  );

-- Create function to check if user has access to task
CREATE OR REPLACE FUNCTION has_task_access(p_task_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM tasks t
    JOIN company_members cm ON cm.company_id = t.company_id
    JOIN user_profiles up ON up.current_company_id = cm.company_id
    WHERE cm.user_id = auth.uid()
    AND t.id = p_task_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get accessible tasks
CREATE OR REPLACE FUNCTION get_accessible_tasks(
  p_filter text DEFAULT NULL,
  p_company_id uuid DEFAULT NULL
)
RETURNS SETOF tasks AS $$
BEGIN
  RETURN QUERY
  SELECT t.*
  FROM tasks t
  JOIN company_members cm ON cm.company_id = t.company_id
  JOIN user_profiles up ON up.current_company_id = cm.company_id
  WHERE cm.user_id = auth.uid()
  AND (p_company_id IS NULL OR t.company_id = p_company_id)
  AND (
    p_filter IS NULL OR
    CASE p_filter
      WHEN 'my' THEN t.responsible_id = auth.uid()
      WHEN 'created' THEN t.owner_id = auth.uid()
      ELSE true
    END
  )
  ORDER BY t.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;