-- Create company_invites table
CREATE TABLE company_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
  email text NOT NULL,
  role text NOT NULL CHECK (role IN ('admin', 'member')),
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) NOT NULL,
  used_at timestamptz,
  used_by uuid REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE company_invites ENABLE ROW LEVEL SECURITY;

-- Create policies for company_invites
CREATE POLICY "Company admins can manage invites"
  ON company_invites
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_id = company_invites.company_id
      AND user_id = auth.uid()
      AND role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_id = company_invites.company_id
      AND user_id = auth.uid()
      AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Users can verify their own invites"
  ON company_invites
  FOR SELECT
  TO authenticated
  USING (
    email = (
      SELECT email FROM user_profiles
      WHERE user_id = auth.uid()
    )
  );

-- Create function to handle invite acceptance
CREATE OR REPLACE FUNCTION accept_company_invite(p_token text)
RETURNS boolean AS $$
DECLARE
  v_invite company_invites%ROWTYPE;
  v_user_id uuid;
BEGIN
  -- Get current user
  SELECT auth.uid() INTO v_user_id;
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No authenticated user';
  END IF;

  -- Get invite
  SELECT * INTO v_invite
  FROM company_invites
  WHERE token = p_token
  AND used_at IS NULL
  AND expires_at > now();

  IF v_invite.id IS NULL THEN
    RETURN false;
  END IF;

  -- Verify email matches
  IF v_invite.email != (
    SELECT email FROM user_profiles
    WHERE user_id = v_user_id
  ) THEN
    RETURN false;
  END IF;

  -- Add user to company
  INSERT INTO company_members (company_id, user_id, role)
  VALUES (v_invite.company_id, v_user_id, v_invite.role)
  ON CONFLICT (company_id, user_id) DO UPDATE
  SET role = v_invite.role;

  -- Mark invite as used
  UPDATE company_invites
  SET 
    used_at = now(),
    used_by = v_user_id
  WHERE id = v_invite.id;

  -- Set as current company if user has none
  UPDATE user_profiles
  SET current_company_id = v_invite.company_id
  WHERE user_id = v_user_id
  AND current_company_id IS NULL;

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;