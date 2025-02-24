-- Drop existing function if it exists
DROP FUNCTION IF EXISTS get_company_members(uuid);

-- Create improved function to get company members
CREATE OR REPLACE FUNCTION get_company_members(p_company_id uuid)
RETURNS TABLE (
  user_id uuid,
  role text,
  email text,
  first_name text,
  last_name text
) AS $$
BEGIN
  -- Return members with their profile information
  RETURN QUERY
  SELECT 
    cm.user_id,
    cm.role,
    up.email,
    up.first_name,
    up.last_name
  FROM company_members cm
  LEFT JOIN user_profiles up ON up.user_id = cm.user_id
  WHERE cm.company_id = p_company_id
  ORDER BY 
    CASE cm.role 
      WHEN 'owner' THEN 1
      WHEN 'admin' THEN 2
      ELSE 3
    END,
    COALESCE(up.email, '');

  -- If no rows returned, return empty result
  IF NOT FOUND THEN
    RETURN;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS company_members_user_id_idx ON company_members(user_id);
CREATE INDEX IF NOT EXISTS company_members_company_id_idx ON company_members(company_id);
CREATE INDEX IF NOT EXISTS user_profiles_user_id_idx ON user_profiles(user_id);

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_company_members(uuid) TO authenticated;