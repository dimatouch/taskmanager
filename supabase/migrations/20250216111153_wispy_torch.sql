-- Drop existing policies first
DO $$ 
BEGIN
  -- Drop policies if they exist
  DROP POLICY IF EXISTS "Company admins can manage invites" ON company_invites;
  DROP POLICY IF EXISTS "Users can verify their own invites" ON company_invites;
  DROP POLICY IF EXISTS "Full access to company members" ON company_members;
END $$;

-- Create improved policies for company_members
CREATE POLICY "Company members access"
  ON company_members
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create function to get member details
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
    END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;