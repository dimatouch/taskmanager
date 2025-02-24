-- Drop existing policies
DROP POLICY IF EXISTS "Admins can manage roles" ON user_roles;
DROP POLICY IF EXISTS "Users can view their own role" ON user_roles;

-- Create new policies without recursion
CREATE POLICY "View own role"
  ON user_roles
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can manage roles"
  ON user_roles
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
      AND ur.role = 'admin'
      AND ur.user_id != user_roles.user_id -- Prevent recursion by excluding self
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
      AND ur.role = 'admin'
      AND ur.user_id != user_roles.user_id -- Prevent recursion by excluding self
    )
  );

-- Create function to make first user admin
CREATE OR REPLACE FUNCTION make_first_user_admin()
RETURNS trigger AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM user_roles) THEN
    INSERT INTO user_roles (user_id, role, created_by)
    VALUES (NEW.id, 'admin', NEW.id);
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

-- Insert test admin if no roles exist
INSERT INTO user_roles (user_id, role, created_by)
SELECT 
  auth.uid(),
  'admin',
  auth.uid()
WHERE 
  NOT EXISTS (SELECT 1 FROM user_roles)
  AND auth.uid() IS NOT NULL;