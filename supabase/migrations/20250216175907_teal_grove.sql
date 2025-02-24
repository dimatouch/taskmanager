-- Create view for company member profiles
CREATE OR REPLACE VIEW company_member_profiles AS
SELECT 
  cm.company_id,
  cm.user_id,
  cm.role,
  up.email,
  up.first_name,
  up.last_name
FROM company_members cm
JOIN user_profiles up ON up.user_id = cm.user_id;

-- Update task activities policy to be more permissive
DROP POLICY IF EXISTS "Company members can access task activities" ON task_activities;

CREATE POLICY "Full access to task activities"
  ON task_activities
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create function to get company users with proper joins
CREATE OR REPLACE FUNCTION get_company_users(p_company_id uuid)
RETURNS TABLE (
  id uuid,
  email text,
  first_name text,
  last_name text,
  role text
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cm.user_id as id,
    up.email,
    up.first_name,
    up.last_name,
    cm.role
  FROM company_members cm
  JOIN user_profiles up ON up.user_id = cm.user_id
  WHERE cm.company_id = p_company_id
  ORDER BY up.email;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;