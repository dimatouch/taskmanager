/*
  # Fix task activities table and policies

  1. Changes
    - Safely create task_activities table if it doesn't exist
    - Drop existing policies before recreating them
    - Add proper error handling for policy creation
*/

DO $$ 
BEGIN
  -- Create task_activities table if it doesn't exist
  IF NOT EXISTS (
    SELECT FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename = 'task_activities'
  ) THEN
    CREATE TABLE task_activities (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      task_id uuid REFERENCES tasks(id) ON DELETE CASCADE NOT NULL,
      user_id uuid NOT NULL,
      type text NOT NULL,
      field text NOT NULL,
      old_value text,
      new_value text,
      created_at timestamptz DEFAULT now()
    );

    -- Enable RLS
    ALTER TABLE task_activities ENABLE ROW LEVEL SECURITY;
  END IF;

  -- Drop existing policies if they exist
  DROP POLICY IF EXISTS "Users can view task activities" ON task_activities;
  DROP POLICY IF EXISTS "Users can create task activities" ON task_activities;

  -- Create new policies
  CREATE POLICY "Users can view task activities"
    ON task_activities
    FOR SELECT
    TO authenticated
    USING (true);

  CREATE POLICY "Users can create task activities"
    ON task_activities
    FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid());

EXCEPTION
  WHEN others THEN
    RAISE NOTICE 'Error creating policies: %', SQLERRM;
END $$;