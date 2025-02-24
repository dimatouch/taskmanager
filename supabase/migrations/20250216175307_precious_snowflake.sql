-- Create function to get company members
CREATE OR REPLACE FUNCTION get_company_members(p_company_id uuid)
RETURNS TABLE (
  user_id uuid,
  role text,
  email text,
  first_name text,
  last_name text
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cm.user_id,
    cm.role,
    up.email,
    up.first_name,
    up.last_name
  FROM company_members cm
  JOIN user_profiles up ON up.user_id = cm.user_id
  WHERE cm.company_id = p_company_id
  ORDER BY 
    CASE cm.role 
      WHEN 'owner' THEN 1
      WHEN 'admin' THEN 2
      ELSE 3
    END,
    up.email;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;