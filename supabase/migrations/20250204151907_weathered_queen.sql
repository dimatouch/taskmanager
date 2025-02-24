/*
  # Add task activities tracking
  
  1. Changes
    - Creates task_activities table if it doesn't exist
    - Adds RLS policies for task activities
    - Handles existing policies gracefully
  
  2. Security
    - Enables RLS on task_activities table
    - Adds policies for viewing and creating activities
*/

DO $$ 
BEGIN
  -- Drop existing policies first to avoid conflicts
  DROP POLICY IF EXISTS "Users can view task activities" ON task_activities;
  DROP POLICY IF EXISTS "Users can create task activities" ON task_activities;

  -- Create task_activities table if it doesn't exist
  CREATE TABLE IF NOT EXISTS task_activities (
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
  WHEN duplicate_table THEN
    RAISE NOTICE 'Table task_activities already exists, skipping creation';
  WHEN duplicate_object THEN
    RAISE NOTICE 'Policy already exists, skipping creation';
  WHEN others THEN
    RAISE NOTICE 'Error: %', SQLERRM;
END $$;