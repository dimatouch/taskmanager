-- Drop existing policies
DROP POLICY IF EXISTS "Full access to company members" ON company_members;
DROP POLICY IF EXISTS "Company members access" ON company_members;

-- Create new permissive policies for company members
CREATE POLICY "Company members full access"
  ON company_members
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create function to handle new user creation and company assignment
CREATE OR REPLACE FUNCTION handle_new_user_company()
RETURNS trigger AS $$
DECLARE
  v_company_id uuid;
  v_created_by uuid;
BEGIN
  -- Get metadata
  v_created_by := (NEW.raw_user_meta_data->>'created_by')::uuid;
  
  IF v_created_by IS NOT NULL THEN
    -- Get company from creator's profile
    SELECT current_company_id INTO v_company_id
    FROM user_profiles
    WHERE user_id = v_created_by;

    -- Add user to company if company found
    IF v_company_id IS NOT NULL THEN
      INSERT INTO company_members (
        company_id,
        user_id,
        role
      ) VALUES (
        v_company_id,
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'role', 'member')
      );

      -- Set as current company
      UPDATE user_profiles
      SET current_company_id = v_company_id
      WHERE user_id = NEW.id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user company assignment
DROP TRIGGER IF EXISTS handle_new_user_company_trigger ON auth.users;
CREATE TRIGGER handle_new_user_company_trigger
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user_company();

-- Create function to get company member profiles
CREATE OR REPLACE FUNCTION get_company_member_profiles(p_company_id uuid)
RETURNS TABLE (
  user_id uuid,
  role text,
  email text,
  first_name text,
  last_name text,
  created_at timestamptz
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cm.user_id,
    cm.role,
    up.email,
    up.first_name,
    up.last_name,
    up.created_at
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