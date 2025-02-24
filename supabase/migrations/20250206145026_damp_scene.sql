-- Drop existing admin_create_user function if it exists
DROP FUNCTION IF EXISTS admin_create_user(uuid, text, text);

-- Create simplified user_roles table policies
DROP POLICY IF EXISTS "Users can view all roles" ON user_roles;
DROP POLICY IF EXISTS "Admins can insert roles" ON user_roles;
DROP POLICY IF EXISTS "Admins can update roles" ON user_roles;
DROP POLICY IF EXISTS "Admins can delete roles" ON user_roles;

-- Create new simplified policies
CREATE POLICY "Full access to roles"
  ON user_roles
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create function to make first user admin
CREATE OR REPLACE FUNCTION make_first_user_admin()
RETURNS trigger AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM user_roles) THEN
    INSERT INTO user_roles (user_id, role, created_by, is_admin)
    VALUES (NEW.id, 'admin', NEW.id, true);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to make first user admin
DROP TRIGGER IF EXISTS make_first_user_admin_trigger ON auth.users;
CREATE TRIGGER make_first_user_admin_trigger
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION make_first_user_admin();

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