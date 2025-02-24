-- Create subtask_assistant table
CREATE TABLE subtask_assistant (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  openai_assistant_id text NOT NULL UNIQUE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE subtask_assistant ENABLE ROW LEVEL SECURITY;

-- Create policy for subtask_assistant
CREATE POLICY "Full access to subtask assistant"
  ON subtask_assistant
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create trigger to update updated_at
CREATE OR REPLACE FUNCTION update_subtask_assistant_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_subtask_assistant_updated_at
  BEFORE UPDATE ON subtask_assistant
  FOR EACH ROW
  EXECUTE FUNCTION update_subtask_assistant_updated_at();