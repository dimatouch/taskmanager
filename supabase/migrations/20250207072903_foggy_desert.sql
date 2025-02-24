-- First ensure we have the task_statuses table
CREATE TABLE IF NOT EXISTS task_statuses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  color text NOT NULL,
  position integer NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS if not already enabled
ALTER TABLE task_statuses ENABLE ROW LEVEL SECURITY;

-- Create policy if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'task_statuses' 
    AND policyname = 'Full access to task statuses'
  ) THEN
    CREATE POLICY "Full access to task statuses"
      ON task_statuses
      FOR ALL
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- Delete any existing statuses to ensure clean state
DELETE FROM task_statuses;

-- Insert default statuses with correct colors
INSERT INTO task_statuses (name, color, position) VALUES
  ('To Do', '#6366F1', 1),        -- Indigo
  ('In Progress', '#F59E0B', 2),  -- Amber
  ('Review', '#8B5CF6', 3),       -- Purple
  ('Done', '#10B981', 4);         -- Emerald