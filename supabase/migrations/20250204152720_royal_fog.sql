/*
  # Fix task activities table structure

  1. Changes
    - Drop and recreate task_activities table with proper foreign key relationships
    - Add proper indexes for performance
    - Update RLS policies
  
  2. Security
    - Enable RLS
    - Add policies for viewing and creating activities
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
  created_at timestamptz DEFAULT now(),
  -- Add indexes for better query performance
  CONSTRAINT task_activities_task_id_created_at_idx UNIQUE (task_id, created_at)
);

-- Create indexes
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

-- Insert some initial test activities if needed
INSERT INTO task_activities (task_id, user_id, type, field, old_value, new_value)
SELECT 
  t.id,
  t.owner_id,
  'create',
  'status',
  NULL,
  s.name
FROM tasks t
JOIN task_statuses s ON s.id = t.status_id
WHERE NOT EXISTS (
  SELECT 1 FROM task_activities 
  WHERE task_id = t.id
)
LIMIT 5;