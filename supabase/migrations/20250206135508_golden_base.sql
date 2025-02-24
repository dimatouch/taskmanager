-- Drop existing function if it exists
DROP FUNCTION IF EXISTS create_invite(text);

-- Create improved create_invite function
CREATE OR REPLACE FUNCTION create_invite(p_email text)
RETURNS uuid AS $$
DECLARE
  v_invite_id uuid;
  v_user_id uuid;
BEGIN
  -- Get current user ID
  SELECT auth.uid() INTO v_user_id;
  
  -- Check if user is admin
  IF NOT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = v_user_id
    AND is_admin = true
  ) THEN
    RAISE EXCEPTION 'Only admins can create invites';
  END IF;

  -- Create invite
  INSERT INTO user_invites (email, created_by)
  VALUES (p_email, v_user_id)
  RETURNING id INTO v_invite_id;

  RETURN v_invite_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION create_invite(text) TO authenticated;