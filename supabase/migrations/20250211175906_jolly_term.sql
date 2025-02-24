-- Add task_id column to ideas table if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'ideas' AND column_name = 'task_id'
  ) THEN
    ALTER TABLE ideas ADD COLUMN task_id uuid REFERENCES tasks(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS ideas_task_id_idx ON ideas(task_id);