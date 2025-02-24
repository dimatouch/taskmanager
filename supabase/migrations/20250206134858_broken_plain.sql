-- Drop existing policies and triggers
DROP POLICY IF EXISTS "View own role" ON user_roles;
DROP POLICY IF EXISTS "Admins can manage roles" ON user_roles;
DROP TRIGGER IF EXISTS make_first_user_admin_trigger ON auth.users;
DROP FUNCTION IF EXISTS make_first_user_admin();

-- Create a materialized admin flag for better performance
ALTER TABLE user_roles ADD COLUMN IF NOT EXISTS is_admin boolean DEFAULT false;

-- Create function to check admin status
CREATE OR REPLACE FUNCTION check_admin_access()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND is_admin = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create simplified policies
CREATE POLICY "Users can view all roles"
  ON user_roles
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert roles"
  ON user_roles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    check_admin_access() OR
    NOT EXISTS (SELECT 1 FROM user_roles) -- Allow first user
  );

CREATE POLICY "Admins can update roles"
  ON user_roles
  FOR UPDATE
  TO authenticated
  USING (check_admin_access());

CREATE POLICY "Admins can delete roles"
  ON user_roles
  FOR DELETE
  TO authenticated
  USING (check_admin_access());

-- Function to set admin flag
CREATE OR REPLACE FUNCTION set_admin_flag()
RETURNS trigger AS $$
BEGIN
  NEW.is_admin = NEW.role = 'admin';
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to maintain admin flag
CREATE TRIGGER set_admin_flag_trigger
  BEFORE INSERT OR UPDATE ON user_roles
  FOR EACH ROW
  EXECUTE FUNCTION set_admin_flag();

-- Make first user admin
INSERT INTO user_roles (user_id, role, created_by)
SELECT 
  auth.uid(),
  'admin',
  auth.uid()
WHERE 
  NOT EXISTS (SELECT 1 FROM user_roles)
  AND auth.uid() IS NOT NULL;

-- Update existing records
UPDATE user_roles SET is_admin = (role = 'admin');