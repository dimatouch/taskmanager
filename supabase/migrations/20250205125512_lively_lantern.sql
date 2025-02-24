DO $$ 
BEGIN
  -- Drop existing policies if they exist
  DROP POLICY IF EXISTS "Full access to tasks" ON tasks;
  DROP POLICY IF EXISTS "Full access to task statuses" ON task_statuses;
  DROP POLICY IF EXISTS "Full access to task assignees" ON task_assignees;
  DROP POLICY IF EXISTS "Full access to task activities" ON task_activities;
  DROP POLICY IF EXISTS "Full access to projects" ON projects;

  -- Create new permissive policies for tasks
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'tasks' AND policyname = 'Full access to tasks'
  ) THEN
    CREATE POLICY "Full access to tasks"
      ON tasks
      FOR ALL
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;

  -- Create new permissive policies for task_statuses
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'task_statuses' AND policyname = 'Full access to task statuses'
  ) THEN
    CREATE POLICY "Full access to task statuses"
      ON task_statuses
      FOR ALL
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;

  -- Create new permissive policies for task_assignees
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'task_assignees' AND policyname = 'Full access to task assignees'
  ) THEN
    CREATE POLICY "Full access to task assignees"
      ON task_assignees
      FOR ALL
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;

  -- Create new permissive policies for task_activities
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'task_activities' AND policyname = 'Full access to task activities'
  ) THEN
    CREATE POLICY "Full access to task activities"
      ON task_activities
      FOR ALL
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;

  -- Create new permissive policies for projects
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'projects' AND policyname = 'Full access to projects'
  ) THEN
    CREATE POLICY "Full access to projects"
      ON projects
      FOR ALL
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;

END $$;