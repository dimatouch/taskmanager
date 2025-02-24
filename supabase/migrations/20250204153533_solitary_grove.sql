/*
  # Fix task activities user relationship

  1. Changes
    - Drop and recreate task_activities table with proper foreign key relationship
    - Add proper indexes for performance
    - Update policies to handle the relationship

  2. Security
    - Maintain existing RLS policies
    - Ensure proper cascade behavior
*/

-- Drop existing table and policies
DROP TABLE IF EXISTS task_activities CASCADE;

-- Create task_activities table with proper relationships
CREATE TABLE task_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid REFERENCES tasks(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  type text NOT NULL CHECK (type IN ('update', 'create', 'delete')),
  field text NOT NULL,
  old_value text,
  new_value text,
  created_at timestamptz DEFAULT now()
);

-- Create indexes for better performance
CREATE INDEX task_activities_task_id_idx ON task_activities(task_id);
CREATE INDEX task_activities_user_id_idx ON task_activities(user_id);
CREATE INDEX task_activities_created_at_idx ON task_activities(created_at DESC);

-- Enable RLS
ALTER TABLE task_activities ENABLE ROW LEVEL SECURITY;

-- Create policies
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

CREATE POLICY "Users can delete task activities"
  ON task_activities
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());