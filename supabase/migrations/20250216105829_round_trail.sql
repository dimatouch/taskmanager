-- Create Touch company if it doesn't exist
INSERT INTO companies (name, slug, owner_id)
SELECT 
  'Touch', 
  'touch',
  (SELECT id FROM auth.users ORDER BY created_at ASC LIMIT 1)
WHERE NOT EXISTS (
  SELECT 1 FROM companies WHERE slug = 'touch'
)
RETURNING id;

-- Set Touch as current company for all users who don't have one
WITH touch_company AS (
  SELECT id FROM companies WHERE slug = 'touch'
)
UPDATE user_profiles
SET current_company_id = (SELECT id FROM touch_company)
WHERE current_company_id IS NULL;

-- Add all users as members of Touch company
WITH touch_company AS (
  SELECT id FROM companies WHERE slug = 'touch'
)
INSERT INTO company_members (company_id, user_id, role)
SELECT 
  (SELECT id FROM touch_company),
  u.id,
  'member'
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM company_members cm 
  WHERE cm.company_id = (SELECT id FROM touch_company)
  AND cm.user_id = u.id
);

-- Update function to handle new user creation
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
  -- Create user profile
  INSERT INTO user_profiles (user_id, email, first_name, last_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', '')
  );

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
      COALESCE((NEW.raw_user_meta_data->>'created_by')::uuid, NEW.id),
      COALESCE((NEW.raw_user_meta_data->>'role')::text = 'admin', false)
    );
  END IF;

  -- For new users, company selection will be required during onboarding
  -- They will not be automatically added to Touch company
  
  RETURN NEW;
END;
$$;