-- Create policy for deleting ideas
CREATE POLICY "Users can delete their own ideas"
  ON ideas
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Create function to log idea deletions
CREATE OR REPLACE FUNCTION log_idea_deletion()
RETURNS trigger AS $$
BEGIN
  INSERT INTO task_activities (
    task_id,
    user_id,
    type,
    field,
    old_value
  )
  SELECT
    t.id,
    OLD.user_id,
    'delete',
    'idea',
    OLD.content
  FROM tasks t
  WHERE t.id = (
    SELECT id FROM tasks 
    WHERE description LIKE '%Converted from idea: ' || OLD.id || '%'
    LIMIT 1
  );
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for logging idea deletions
CREATE TRIGGER log_idea_deletion_trigger
  BEFORE DELETE ON ideas
  FOR EACH ROW
  EXECUTE FUNCTION log_idea_deletion();