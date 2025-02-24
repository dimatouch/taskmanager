-- Drop existing table if it exists
DROP TABLE IF EXISTS task_formatter_assistant CASCADE;

-- Create task_formatter_assistant table
CREATE TABLE task_formatter_assistant (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  openai_assistant_id text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE task_formatter_assistant ENABLE ROW LEVEL SECURITY;

-- Create policy for task_formatter_assistant
CREATE POLICY "Full access to task formatter assistant"
  ON task_formatter_assistant
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create trigger to update updated_at
CREATE OR REPLACE FUNCTION update_task_formatter_assistant_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_task_formatter_assistant_updated_at
  BEFORE UPDATE ON task_formatter_assistant
  FOR EACH ROW
  EXECUTE FUNCTION update_task_formatter_assistant_updated_at();