-- Drop existing policies
DROP POLICY IF EXISTS "Full access to roles" ON user_roles;

-- Create simplified policies for user_roles
CREATE POLICY "Users can view roles"
  ON user_roles
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage roles"
  ON user_roles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND is_admin = true
    )
  );

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