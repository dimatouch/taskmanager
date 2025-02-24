-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view task viewers" ON task_viewers;
DROP POLICY IF EXISTS "Task owners and responsible users can manage viewers" ON task_viewers;

-- Create task_viewers table if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename = 'task_viewers'
  ) THEN
    CREATE TABLE task_viewers (
      task_id uuid REFERENCES tasks(id) ON DELETE CASCADE,
      user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
      created_at timestamptz DEFAULT now(),
      PRIMARY KEY (task_id, user_id)
    );

    -- Create indexes for better performance
    CREATE INDEX task_viewers_task_id_idx ON task_viewers(task_id);
    CREATE INDEX task_viewers_user_id_idx ON task_viewers(user_id);

    -- Enable RLS
    ALTER TABLE task_viewers ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- Create policies for task_viewers
CREATE POLICY "Users can view task viewers"
  ON task_viewers
  FOR SELECT
  TO authenticated
  USING (
    -- Users can see viewers if they:
    -- 1. Own the task
    EXISTS (
      SELECT 1 FROM tasks
      WHERE id = task_viewers.task_id
      AND owner_id = auth.uid()
    ) OR
    -- 2. Are responsible for the task
    EXISTS (
      SELECT 1 FROM tasks
      WHERE id = task_viewers.task_id
      AND responsible_id = auth.uid()
    ) OR
    -- 3. Are a co-worker on the task
    EXISTS (
      SELECT 1 FROM tasks
      WHERE id = task_viewers.task_id
      AND auth.uid() = ANY(coworkers)
    ) OR
    -- 4. Are a viewer themselves
    user_id = auth.uid()
  );

CREATE POLICY "Task owners and responsible users can manage viewers"
  ON task_viewers
  FOR ALL
  TO authenticated
  USING (
    -- Task owners and responsible users can manage viewers
    EXISTS (
      SELECT 1 FROM tasks
      WHERE id = task_viewers.task_id
      AND (owner_id = auth.uid() OR responsible_id = auth.uid())
    )
  )
  WITH CHECK (
    -- Task owners and responsible users can manage viewers
    EXISTS (
      SELECT 1 FROM tasks
      WHERE id = task_viewers.task_id
      AND (owner_id = auth.uid() OR responsible_id = auth.uid())
    )
  );

-- Update task_activities type check to include viewer changes
DO $$ 
BEGIN
  ALTER TABLE task_activities 
  DROP CONSTRAINT IF EXISTS task_activities_type_check;

  ALTER TABLE task_activities 
  ADD CONSTRAINT task_activities_type_check 
  CHECK (type IN ('update', 'create', 'delete', 'comment', 'progress', 'attachment', 'viewer'));
END $$;