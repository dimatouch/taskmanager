/*
  # Add task assignees table
  
  1. New Tables
    - `task_assignees`
      - `task_id` (uuid, references tasks)
      - `user_id` (uuid, references auth.users)
      - `is_responsible` (boolean)
      - `created_at` (timestamp)
  
  2. Security
    - Enable RLS
    - Add policy for authenticated users
*/

-- Create task_assignees table
CREATE TABLE task_assignees (
  task_id uuid REFERENCES tasks(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  is_responsible boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (task_id, user_id)
);

-- Create indexes for better performance
CREATE INDEX task_assignees_task_id_idx ON task_assignees(task_id);
CREATE INDEX task_assignees_user_id_idx ON task_assignees(user_id);
CREATE INDEX task_assignees_is_responsible_idx ON task_assignees(is_responsible);

-- Enable RLS
ALTER TABLE task_assignees ENABLE ROW LEVEL SECURITY;

-- Create policy for authenticated users
CREATE POLICY "Full access to task assignees"
  ON task_assignees
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create function to ensure only one responsible person per task
CREATE OR REPLACE FUNCTION ensure_single_responsible()
RETURNS trigger AS $$
BEGIN
  IF NEW.is_responsible THEN
    -- Set all other assignees for this task to not responsible
    UPDATE task_assignees
    SET is_responsible = false
    WHERE task_id = NEW.task_id
    AND user_id != NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to maintain single responsible person
CREATE TRIGGER ensure_single_responsible_trigger
  AFTER INSERT OR UPDATE ON task_assignees
  FOR EACH ROW
  EXECUTE FUNCTION ensure_single_responsible();