-- Add is_responsible column to task_assignees
ALTER TABLE task_assignees 
ADD COLUMN is_responsible boolean NOT NULL DEFAULT false;

-- Create index for better performance
CREATE INDEX task_assignees_is_responsible_idx ON task_assignees(is_responsible);

-- Update existing data to mark first assignee as responsible
WITH RankedAssignees AS (
  SELECT 
    task_id,
    user_id,
    ROW_NUMBER() OVER (PARTITION BY task_id ORDER BY created_at) as rn
  FROM task_assignees
)
UPDATE task_assignees ta
SET is_responsible = true
FROM RankedAssignees ra
WHERE ta.task_id = ra.task_id 
AND ta.user_id = ra.user_id 
AND ra.rn = 1;

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