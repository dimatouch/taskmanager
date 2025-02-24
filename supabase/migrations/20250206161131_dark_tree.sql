-- Drop existing policies
DROP POLICY IF EXISTS "Anonymous access to tasks" ON tasks;
DROP POLICY IF EXISTS "Anonymous access to task statuses" ON task_statuses;
DROP POLICY IF EXISTS "Anonymous access to task assignees" ON task_assignees;
DROP POLICY IF EXISTS "Anonymous access to task activities" ON task_activities;
DROP POLICY IF EXISTS "Anonymous access to projects" ON projects;

-- Drop existing user_roles table and recreate it
DROP TABLE IF EXISTS user_roles CASCADE;

CREATE TABLE user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role text NOT NULL CHECK (role IN ('admin', 'user')),
  is_admin boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) NOT NULL
);

-- Create indexes
CREATE INDEX user_roles_user_id_idx ON user_roles(user_id);
CREATE INDEX user_roles_is_admin_idx ON user_roles(is_admin);

-- Enable RLS
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- Create policies for user_roles
CREATE POLICY "Users can view roles"
  ON user_roles
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage roles"
  ON user_roles
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND is_admin = true
    )
  );

-- Create function to handle new user creation
CREATE OR REPLACE FUNCTION handle_new_user() 
RETURNS trigger AS $$
BEGIN
  -- Only create role if one doesn't already exist for this user
  IF NOT EXISTS (SELECT 1 FROM user_roles WHERE user_id = NEW.id) THEN
    -- Make user admin if they're the first user
    IF NOT EXISTS (SELECT 1 FROM user_roles) THEN
      INSERT INTO user_roles (user_id, role, created_by, is_admin)
      VALUES (NEW.id, 'admin', NEW.id, true);
    ELSE
      -- For users created through admin panel, use the role from metadata
      INSERT INTO user_roles (user_id, role, created_by, is_admin)
      VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'role', 'user'),
        COALESCE((NEW.raw_user_meta_data->>'created_by')::uuid, NEW.id),
        COALESCE((NEW.raw_user_meta_data->>'role')::text = 'admin', false)
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user handling
DROP TRIGGER IF EXISTS handle_new_user_trigger ON auth.users;
CREATE TRIGGER handle_new_user_trigger
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- Make all existing users admins if they don't have a role
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