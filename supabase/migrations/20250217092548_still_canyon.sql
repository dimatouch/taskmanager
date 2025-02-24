-- Drop all existing triggers and functions with CASCADE
DROP TRIGGER IF EXISTS handle_new_user_trigger ON auth.users CASCADE;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users CASCADE;
DROP TRIGGER IF EXISTS handle_new_user_company_trigger ON auth.users CASCADE;
DROP TRIGGER IF EXISTS initialize_calendar_settings_trigger ON auth.users CASCADE;
DROP TRIGGER IF EXISTS initialize_dashboard_settings_trigger ON auth.users CASCADE;
DROP TRIGGER IF EXISTS make_first_user_admin_trigger ON auth.users CASCADE;

-- Drop all user-related functions with CASCADE
DROP FUNCTION IF EXISTS handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS handle_new_user_company() CASCADE;
DROP FUNCTION IF EXISTS initialize_calendar_settings() CASCADE;
DROP FUNCTION IF EXISTS initialize_dashboard_settings() CASCADE;
DROP FUNCTION IF EXISTS make_first_user_admin() CASCADE;

-- Drop existing policies first
DROP POLICY IF EXISTS "Full access to profiles" ON user_profiles;
DROP POLICY IF EXISTS "Full access to company members" ON company_members;
DROP POLICY IF EXISTS "Full access to user roles" ON user_roles;

-- Create maximally permissive policies
CREATE POLICY "Permissive access to profiles"
  ON user_profiles
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Permissive access to company members"
  ON company_members
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Permissive access to user roles"
  ON user_roles
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

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