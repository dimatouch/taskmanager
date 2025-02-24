-- Drop existing triggers first
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users CASCADE;

-- Now we can safely drop the functions
DROP FUNCTION IF EXISTS verify_invite(text);
DROP FUNCTION IF EXISTS register_with_token(text, uuid);
DROP FUNCTION IF EXISTS handle_auth_user_created();

-- Drop user_invites table
DROP TABLE IF EXISTS user_invites;

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