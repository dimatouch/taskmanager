/*
  # Create user dashboard settings

  1. New Tables
    - `user_dashboard_settings`
      - `user_id` (uuid, primary key)
      - `widgets` (jsonb array of widget settings)
      - `layout` (jsonb with widget positions)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS
    - Add policy for users to manage their own settings
*/

-- Create user_dashboard_settings table
CREATE TABLE user_dashboard_settings (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  widgets jsonb[] DEFAULT '{}',
  layout jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE user_dashboard_settings ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own dashboard settings"
  ON user_dashboard_settings
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can manage their own dashboard settings"
  ON user_dashboard_settings
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Create function to initialize default settings for new users
CREATE OR REPLACE FUNCTION initialize_dashboard_settings()
RETURNS trigger AS $$
BEGIN
  INSERT INTO user_dashboard_settings (
    user_id,
    widgets,
    layout
  ) VALUES (
    NEW.id,
    ARRAY[
      '{"type": "active_tasks", "size": "large"}'::jsonb,
      '{"type": "upcoming_deadlines", "size": "medium"}'::jsonb,
      '{"type": "quick_task", "size": "small"}'::jsonb,
      '{"type": "task_stats", "size": "medium"}'::jsonb
    ],
    '{
      "active_tasks": {"x": 0, "y": 0, "w": 12, "h": 4},
      "upcoming_deadlines": {"x": 0, "y": 4, "w": 6, "h": 3},
      "quick_task": {"x": 6, "y": 4, "w": 6, "h": 2},
      "task_stats": {"x": 6, "y": 6, "w": 6, "h": 3}
    }'::jsonb
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user initialization
CREATE TRIGGER initialize_dashboard_settings_trigger
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION initialize_dashboard_settings();

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_dashboard_settings_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updating timestamp
CREATE TRIGGER update_dashboard_settings_updated_at_trigger
  BEFORE UPDATE ON user_dashboard_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_dashboard_settings_updated_at();

-- Initialize settings for existing users
INSERT INTO user_dashboard_settings (
  user_id,
  widgets,
  layout
)
SELECT 
  id as user_id,
  ARRAY[
    '{"type": "active_tasks", "size": "large"}'::jsonb,
    '{"type": "upcoming_deadlines", "size": "medium"}'::jsonb,
    '{"type": "quick_task", "size": "small"}'::jsonb,
    '{"type": "task_stats", "size": "medium"}'::jsonb
  ] as widgets,
  '{
    "active_tasks": {"x": 0, "y": 0, "w": 12, "h": 4},
    "upcoming_deadlines": {"x": 0, "y": 4, "w": 6, "h": 3},
    "quick_task": {"x": 6, "y": 4, "w": 6, "h": 2},
    "task_stats": {"x": 6, "y": 6, "w": 6, "h": 3}
  }'::jsonb as layout
FROM auth.users
ON CONFLICT (user_id) DO NOTHING;