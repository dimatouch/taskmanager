/*
  # Add task activity tracking
  
  1. New Tables
    - `task_activities`
      - `id` (uuid, primary key)
      - `task_id` (uuid, references tasks)
      - `user_id` (uuid, references auth.users)
      - `type` (text) - Type of activity (e.g., 'update', 'status_change', etc.)
      - `field` (text) - Field that was changed
      - `old_value` (text) - Previous value
      - `new_value` (text) - New value
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on `task_activities` table
    - Add policies for authenticated users
*/

-- Create task_activities table
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