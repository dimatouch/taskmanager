/*
  # Grant Admin Roles to All Users

  1. Changes
    - Grants admin role to all existing users
    - Updates is_admin flag for all users
    - Maintains existing admin role functionality
*/

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