-- Drop existing policies
DROP POLICY IF EXISTS "Full access to projects" ON projects;

-- Create new policies for projects
CREATE POLICY "Users can view all projects"
  ON projects
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create projects"
  ON projects
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can update own projects"
  ON projects
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = owner_id);

CREATE POLICY "Users can delete own projects"
  ON projects
  FOR DELETE
  TO authenticated
  USING (auth.uid() = owner_id);

-- Add owner_id to projects if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'projects' AND column_name = 'owner_id'
  ) THEN
    ALTER TABLE projects ADD COLUMN owner_id uuid REFERENCES auth.users(id) NOT NULL;
  END IF;
END $$;