-- Drop existing triggers first
DROP TRIGGER IF EXISTS handle_new_user_trigger ON auth.users CASCADE;
DROP FUNCTION IF EXISTS handle_new_user() CASCADE;

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
  -- Create user profile if it doesn't exist
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
  )
  ON CONFLICT (user_id) DO UPDATE SET
    email = EXCLUDED.email,
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    updated_at = now();

  -- Get creator's company if this user was created by another user
  v_created_by := (NEW.raw_user_meta_data->>'created_by')::uuid;
  
  IF v_created_by IS NOT NULL THEN
    -- Get company from creator's profile
    SELECT current_company_id INTO v_company_id
    FROM user_profiles
    WHERE user_id = v_created_by;

    IF v_company_id IS NOT NULL THEN
      -- Add user to company if not already a member
      INSERT INTO company_members (
        company_id,
        user_id,
        role
      ) VALUES (
        v_company_id,
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'role', 'member')
      )
      ON CONFLICT (company_id, user_id) DO UPDATE SET
        role = EXCLUDED.role,
        updated_at = now();

      -- Set as current company if not set
      UPDATE user_profiles
      SET current_company_id = v_company_id
      WHERE user_id = NEW.id
      AND current_company_id IS NULL;
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
    )
    ON CONFLICT (user_id) DO UPDATE SET
      role = EXCLUDED.role,
      is_admin = EXCLUDED.is_admin,
      updated_at = now();
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger for new user handling
CREATE TRIGGER handle_new_user_trigger
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

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