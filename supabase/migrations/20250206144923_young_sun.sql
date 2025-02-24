-- Drop user_invites table
DROP TABLE IF EXISTS user_invites;

-- Create admin function to create users
CREATE OR REPLACE FUNCTION admin_create_user(
  admin_user_id uuid,
  new_user_email text,
  new_user_password text
) RETURNS uuid AS $$
DECLARE
  new_user_id uuid;
BEGIN
  -- Check if caller is admin
  IF NOT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = admin_user_id
    AND is_admin = true
  ) THEN
    RAISE EXCEPTION 'Only admins can create users';
  END IF;

  -- Create user in auth.users
  INSERT INTO auth.users (
    email,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at
  )
  VALUES (
    new_user_email,
    crypt(new_user_password, gen_salt('bf')),
    now(),
    now(),
    now()
  )
  RETURNING id INTO new_user_id;

  -- Create admin role for new user
  INSERT INTO user_roles (
    user_id,
    role,
    created_by,
    is_admin
  ) VALUES (
    new_user_id,
    'admin',
    admin_user_id,
    true
  );

  RETURN new_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to make first user admin
CREATE OR REPLACE FUNCTION make_first_user_admin()
RETURNS trigger AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM user_roles) THEN
    INSERT INTO user_roles (user_id, role, created_by, is_admin)
    VALUES (NEW.id, 'admin', NEW.id, true);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;