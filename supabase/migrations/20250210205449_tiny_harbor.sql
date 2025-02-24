-- Drop existing policy
DROP POLICY IF EXISTS "Full access to ideas" ON ideas;

-- Create new policy that only allows users to see their own ideas
CREATE POLICY "Users can manage their own ideas"
  ON ideas
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Create index for better performance
CREATE INDEX ideas_user_id_idx ON ideas(user_id);
CREATE INDEX ideas_created_at_idx ON ideas(created_at DESC);