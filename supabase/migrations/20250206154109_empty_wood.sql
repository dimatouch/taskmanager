-- Drop existing triggers and functions in the correct order
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users CASCADE;
DROP TRIGGER IF EXISTS handle_new_user_trigger ON auth.users CASCADE;

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
CREATE TRIGGER handle_new_user_trigger
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- Drop existing policies
DROP POLICY IF EXISTS "Full access to roles" ON user_roles;

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