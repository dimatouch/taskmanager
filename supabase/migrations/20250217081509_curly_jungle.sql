-- Drop existing policies and triggers
DROP POLICY IF EXISTS "Company members full access" ON company_members;
DROP TRIGGER IF EXISTS handle_new_user_company_trigger ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user_company();

-- Create maximally permissive policy for company members
CREATE POLICY "Full access to company members"
  ON company_members
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create improved function to handle new user creation
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
  v_company_id uuid;
  v_created_by uuid;
BEGIN
  -- Create user profile
  INSERT INTO user_profiles (
    user_id,
    email,
    first_name,
    last_name
  ) VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', '')
  );

  -- Get creator's company if this user was created by another user
  v_created_by := (NEW.raw_user_meta_data->>'created_by')::uuid;
  
  IF v_created_by IS NOT NULL THEN
    -- Get company from creator's profile
    SELECT current_company_id INTO v_company_id
    FROM user_profiles
    WHERE user_id = v_created_by;

    IF v_company_id IS NOT NULL THEN
      -- Add user to company
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

  -- Make first user admin if no roles exist
  IF NOT EXISTS (SELECT 1 FROM user_roles) THEN
    INSERT INTO user_roles (user_id, role, created_by, is_admin)
    VALUES (NEW.id, 'admin', NEW.id, true);
  ELSE
    -- For users created through admin panel, use the role from metadata
    INSERT INTO user_roles (user_id, role, created_by, is_admin)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'role', 'user'),
      COALESCE(v_created_by, NEW.id),
      COALESCE((NEW.raw_user_meta_data->>'role')::text = 'admin', false)
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger for new user handling
DROP TRIGGER IF EXISTS handle_new_user_trigger ON auth.users;
CREATE TRIGGER handle_new_user_trigger
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();