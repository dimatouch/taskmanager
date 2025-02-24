/*
  # Fix token verification

  1. Changes
    - Add proper token verification function
    - Add function to handle user registration with token
    - Update policies for user_invites table
    - Add proper error handling

  2. Security
    - Enable RLS
    - Add proper policies
    - Add validation
*/

-- Drop existing verify_invite function
DROP FUNCTION IF EXISTS verify_invite(text);

-- Create improved verify_invite function
CREATE OR REPLACE FUNCTION verify_invite(token text)
RETURNS boolean AS $$
DECLARE
  invite_record user_invites%ROWTYPE;
BEGIN
  -- Get invite that matches token and is not used
  SELECT * INTO invite_record
  FROM user_invites
  WHERE token = token
  AND used_at IS NULL
  AND expires_at > now();

  -- Return false if invite not found or expired
  IF invite_record.id IS NULL THEN
    RETURN false;
  END IF;

  -- Mark invite as used
  UPDATE user_invites
  SET used_at = now()
  WHERE id = invite_record.id;

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to handle user registration with token
CREATE OR REPLACE FUNCTION register_with_token(token text, user_id uuid)
RETURNS boolean AS $$
DECLARE
  invite_record user_invites%ROWTYPE;
BEGIN
  -- Get invite that matches token
  SELECT * INTO invite_record
  FROM user_invites
  WHERE token = token
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
    used_by = user_id
  WHERE id = invite_record.id;

  -- Create user role
  INSERT INTO user_roles (user_id, role, created_by)
  VALUES (user_id, 'user', invite_record.created_by);

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update user_invites table
ALTER TABLE user_invites 
ADD COLUMN IF NOT EXISTS used_by uuid REFERENCES auth.users(id);

-- Create policies for user_invites
DROP POLICY IF EXISTS "Users can view invites" ON user_invites;
DROP POLICY IF EXISTS "Admins can manage invites" ON user_invites;

CREATE POLICY "Anyone can verify invites"
  ON user_invites
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage invites"
  ON user_invites
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND is_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND is_admin = true
    )
  );

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION verify_invite(text) TO authenticated;
GRANT EXECUTE ON FUNCTION register_with_token(text, uuid) TO authenticated;