-- Create task_formatter_assistant table
CREATE TABLE task_formatter_assistant (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  openai_assistant_id text NOT NULL,
  created_at timestamptz DEFAULT now()
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