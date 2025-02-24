/*
  # Admin Access Control System

  1. New Tables
    - `user_invites`
      - `id` (uuid, primary key)
      - `email` (text, unique)
      - `token` (text, unique)
      - `expires_at` (timestamptz)
      - `created_at` (timestamptz)
      - `created_by` (uuid, references auth.users)
      - `used_at` (timestamptz)
      
    - `user_roles`
      - `user_id` (uuid, references auth.users)
      - `role` (text)
      - `created_at` (timestamptz)
      - `created_by` (uuid, references auth.users)

  2. Security
    - Enable RLS on all tables
    - Add policies for admin access
*/

-- Create user_invites table
CREATE TABLE user_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) NOT NULL,
  used_at timestamptz
);

-- Create user_roles table
CREATE TABLE user_roles (
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  role text NOT NULL CHECK (role IN ('admin', 'user')),
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) NOT NULL
);

-- Enable RLS
ALTER TABLE user_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- Create policies for user_invites
CREATE POLICY "Admins can manage invites"
  ON user_invites
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role = 'admin'
    )
  );

-- Create policies for user_roles
CREATE POLICY "Admins can manage roles"
  ON user_roles
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role = 'admin'
    )
  );

CREATE POLICY "Users can view their own role"
  ON user_roles
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Create function to check if user is admin
CREATE OR REPLACE FUNCTION is_admin(user_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = $1
    AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to create invite
CREATE OR REPLACE FUNCTION create_invite(email text)
RETURNS uuid AS $$
DECLARE
  invite_id uuid;
BEGIN
  -- Check if user is admin
  IF NOT is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only admins can create invites';
  END IF;

  -- Create invite
  INSERT INTO user_invites (email, created_by)
  VALUES (email, auth.uid())
  RETURNING id INTO invite_id;

  RETURN invite_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to verify invite
CREATE OR REPLACE FUNCTION verify_invite(token text)
RETURNS boolean AS $$
DECLARE
  invite_record user_invites%ROWTYPE;
BEGIN
  -- Get invite
  SELECT * INTO invite_record
  FROM user_invites
  WHERE token = $1
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