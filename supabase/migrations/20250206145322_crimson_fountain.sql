-- Drop existing policies and functions
DROP POLICY IF EXISTS "Full access to roles" ON user_roles;
DROP TRIGGER IF EXISTS make_first_user_admin_trigger ON auth.users;
DROP FUNCTION IF EXISTS make_first_user_admin();

-- Create simplified policies for user_roles
CREATE POLICY "Full access to roles"
  ON user_roles
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create function to handle new user creation
CREATE OR REPLACE FUNCTION handle_new_user() 
RETURNS trigger AS $$
BEGIN
  -- Make user admin if they're the first user or no roles exist
  IF NOT EXISTS (SELECT 1 FROM user_roles) THEN
    INSERT INTO user_roles (user_id, role, created_by, is_admin)
    VALUES (NEW.id, 'admin', NEW.id, true);
  ELSE
    -- Otherwise, make them a regular user
    INSERT INTO user_roles (user_id, role, created_by, is_admin)
    VALUES (NEW.id, 'user', NEW.id, false);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user handling
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