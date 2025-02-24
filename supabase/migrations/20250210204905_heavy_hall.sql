-- Create ideas table
CREATE TABLE ideas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content text NOT NULL,
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  created_at timestamptz DEFAULT now(),
  converted_to_task boolean DEFAULT false
);

-- Enable RLS
ALTER TABLE ideas ENABLE ROW LEVEL SECURITY;

-- Create policy for ideas
CREATE POLICY "Full access to ideas"
  ON ideas
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);