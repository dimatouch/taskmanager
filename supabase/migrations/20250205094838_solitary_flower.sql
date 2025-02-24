-- Add priority field if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tasks' AND column_name = 'priority'
  ) THEN
    ALTER TABLE tasks
    ADD COLUMN priority smallint DEFAULT 0 CHECK (priority >= 0 AND priority <= 3);
  END IF;
END $$;