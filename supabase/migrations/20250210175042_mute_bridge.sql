/*
  # Add task roles

  1. New Tables
    - `task_roles`
      - `task_id` (uuid, references tasks)
      - `user_id` (uuid, references auth.users)
      - `role` (text, either 'responsible' or 'coworker')
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `task_roles` table
    - Add policies for authenticated users

  3. Changes
    - Add function to ensure only one responsible user per task
    - Add trigger to maintain role consistency
*/

-- Create task_roles table
CREATE TABLE task_roles (
  task_id uuid REFERENCES tasks(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('responsible', 'coworker')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  PRIMARY KEY (task_id, user_id)
);

-- Create indexes for better performance
CREATE INDEX task_roles_task_id_idx ON task_roles(task_id);
CREATE INDEX task_roles_user_id_idx ON task_roles(user_id);
CREATE INDEX task_roles_role_idx ON task_roles(role);

-- Enable RLS
ALTER TABLE task_roles ENABLE ROW LEVEL SECURITY;

-- Create policy for task_roles
CREATE POLICY "Full access to task roles"
  ON task_roles
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create function to ensure only one responsible user per task
CREATE OR REPLACE FUNCTION ensure_single_responsible()
RETURNS trigger AS $$
BEGIN
  IF NEW.role = 'responsible' THEN
    -- Set any existing responsible user to coworker
    UPDATE task_roles
    SET role = 'coworker'
    WHERE task_id = NEW.task_id
    AND role = 'responsible'
    AND user_id != NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for role consistency
CREATE TRIGGER ensure_single_responsible_trigger
  BEFORE INSERT OR UPDATE ON task_roles
  FOR EACH ROW
  EXECUTE FUNCTION ensure_single_responsible();

-- Create function to get task responsible user
CREATE OR REPLACE FUNCTION get_task_responsible(p_task_id uuid)
RETURNS uuid AS $$
  SELECT user_id
  FROM task_roles
  WHERE task_id = p_task_id
  AND role = 'responsible'
  LIMIT 1;
$$ LANGUAGE sql;

-- Create function to get task coworkers
CREATE OR REPLACE FUNCTION get_task_coworkers(p_task_id uuid)
RETURNS SETOF uuid AS $$
  SELECT user_id
  FROM task_roles
  WHERE task_id = p_task_id
  AND role = 'coworker'
  ORDER BY created_at;
$$ LANGUAGE sql;

-- Migrate existing data
DO $$ 
BEGIN
  -- Migrate responsible users
  INSERT INTO task_roles (task_id, user_id, role)
  SELECT 
    id as task_id,
    responsible_id as user_id,
    'responsible' as role
  FROM tasks
  WHERE responsible_id IS NOT NULL
  ON CONFLICT DO NOTHING;

  -- Migrate coworkers
  INSERT INTO task_roles (task_id, user_id, role)
  SELECT 
    t.id as task_id,
    unnest(t.coworkers) as user_id,
    'coworker' as role
  FROM tasks t
  WHERE array_length(t.coworkers, 1) > 0
  ON CONFLICT DO NOTHING;
END $$;