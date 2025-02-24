-- Drop existing triggers and functions
DROP TRIGGER IF EXISTS handle_new_user_trigger ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user();

-- Create function to handle new user creation
CREATE OR REPLACE FUNCTION handle_new_user() 
RETURNS trigger AS $$
BEGIN
  -- Make user admin if they're the first user
  IF NOT EXISTS (SELECT 1 FROM user_roles WHERE user_id != NEW.id) THEN
    INSERT INTO user_roles (user_id, role, created_by, is_admin)
    VALUES (NEW.id, 'admin', NEW.id, true);
  ELSE
    -- For users created through admin panel, use the role from metadata
    INSERT INTO user_roles (user_id, role, created_by, is_admin)
    SELECT
      NEW.id,
      CASE WHEN role_data.role = 'admin' THEN 'admin' ELSE 'user' END,
      role_data.created_by,
      role_data.role = 'admin'
    FROM (
      SELECT 
        COALESCE(NEW.raw_user_meta_data->>'role', 'user') as role,
        COALESCE((NEW.raw_user_meta_data->>'created_by')::uuid, NEW.id) as created_by
    ) as role_data;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user handling
CREATE TRIGGER handle_new_user_trigger
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- Create policy for user_roles
DROP POLICY IF EXISTS "Full access to roles" ON user_roles;
CREATE POLICY "Full access to roles"
  ON user_roles
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);