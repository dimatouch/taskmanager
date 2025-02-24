/*
  # Add Admin Role Support
  
  1. Changes
    - Adds is_admin column to user_roles table
    - Grants admin role to all existing users
    - Updates existing policies to check is_admin flag
*/

-- Add is_admin column to user_roles if it doesn't exist
ALTER TABLE user_roles 
ADD COLUMN IF NOT EXISTS is_admin boolean DEFAULT false;

-- Grant admin role to all users who don't have a role yet
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

-- Update any existing non-admin users to be admins
UPDATE user_roles 
SET 
  role = 'admin',
  is_admin = true
WHERE role != 'admin' OR is_admin = false;

-- Update is_admin function to use new column
CREATE OR REPLACE FUNCTION is_admin(user_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = $1
    AND is_admin = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;