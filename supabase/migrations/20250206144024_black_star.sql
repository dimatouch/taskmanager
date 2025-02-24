/*
  # Fix token verification and registration

  1. Changes
    - Drop existing functions
    - Add proper token verification function
    - Add user registration with token function
    - Add trigger for handling user creation
*/

-- Drop existing functions first
DROP FUNCTION IF EXISTS verify_invite(text);
DROP FUNCTION IF EXISTS register_with_token(text, uuid);

-- Create improved verify_invite function
CREATE OR REPLACE FUNCTION verify_invite(p_token text)
RETURNS boolean AS $$
DECLARE
  invite_record user_invites%ROWTYPE;
BEGIN
  -- Get invite that matches token and is not used
  SELECT * INTO invite_record
  FROM user_invites
  WHERE token = p_token
  AND used_at IS NULL
  AND expires_at > now();

  -- Return false if invite not found or expired
  IF invite_record.id IS NULL THEN
    RETURN false;
  END IF;

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to handle user registration with token
CREATE OR REPLACE FUNCTION register_with_token(p_token text, p_user_id uuid)
RETURNS boolean AS $$
DECLARE
  invite_record user_invites%ROWTYPE;
BEGIN
  -- Get invite that matches token
  SELECT * INTO invite_record
  FROM user_invites
  WHERE token = p_token
  AND used_at IS NULL
  AND expires_at > now();

  -- Return false if invite not found or expired
  IF invite_record.id IS NULL THEN
    RETURN false;
  END IF;

  -- Mark invite as used and associate with user
  UPDATE user_invites
  SET 
    used_at = now(),
    used_by = p_user_id
  WHERE id = invite_record.id;

  -- Create user role
  INSERT INTO user_roles (user_id, role, created_by, is_admin)
  VALUES (p_user_id, 'user', invite_record.created_by, false);

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to handle user registration
CREATE OR REPLACE FUNCTION handle_auth_user_created()
RETURNS trigger AS $$
DECLARE
  invite_token text;
BEGIN
  -- Get invite token from user metadata
  invite_token := NEW.raw_user_meta_data->>'invite_token';
  
  -- If we have an invite token, register the user
  IF invite_token IS NOT NULL THEN
    PERFORM register_with_token(invite_token, NEW.id);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_auth_user_created();

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION verify_invite(text) TO authenticated;
GRANT EXECUTE ON FUNCTION register_with_token(text, uuid) TO authenticated;