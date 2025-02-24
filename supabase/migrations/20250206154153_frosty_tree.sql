-- Drop existing policies
DROP POLICY IF EXISTS "Users can view roles" ON user_roles;
DROP POLICY IF EXISTS "Admins can manage roles" ON user_roles;

-- Create non-recursive policies
CREATE POLICY "View roles"
  ON user_roles
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Manage roles"
  ON user_roles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Allow first user to be created as admin
    NOT EXISTS (SELECT 1 FROM user_roles) OR
    -- Or check if current user is admin
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND is_admin = true
    )
  );

CREATE POLICY "Update roles"
  ON user_roles
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND is_admin = true
    )
  );

CREATE POLICY "Delete roles"
  ON user_roles
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND is_admin = true
    )
  );

-- Create index for better performance
CREATE INDEX IF NOT EXISTS user_roles_user_id_is_admin_idx ON user_roles(user_id, is_admin);

-- Update existing roles to ensure is_admin flag is set correctly
UPDATE user_roles SET is_admin = (role = 'admin');