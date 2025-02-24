-- Create idea_boards table
CREATE TABLE idea_boards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Add board_id to ideas table
ALTER TABLE ideas 
ADD COLUMN board_id uuid REFERENCES idea_boards(id) ON DELETE SET NULL;

-- Create indexes
CREATE INDEX idea_boards_user_id_idx ON idea_boards(user_id);
CREATE INDEX ideas_board_id_idx ON ideas(board_id);

-- Enable RLS
ALTER TABLE idea_boards ENABLE ROW LEVEL SECURITY;

-- Create policies for idea_boards
CREATE POLICY "Users can view all boards"
  ON idea_boards
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create boards"
  ON idea_boards
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own boards"
  ON idea_boards
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own boards"
  ON idea_boards
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());