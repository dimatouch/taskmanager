-- Drop existing objects first
DROP POLICY IF EXISTS "Users can manage their own dashboard settings" ON user_dashboard_settings;
DROP TRIGGER IF EXISTS initialize_dashboard_settings_trigger ON auth.users;
DROP FUNCTION IF EXISTS initialize_dashboard_settings();

-- Drop and recreate user_dashboard_settings table
DROP TABLE IF EXISTS user_dashboard_settings;

-- Create user_dashboard_settings table
CREATE TABLE user_dashboard_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  widgets jsonb DEFAULT '[]'::jsonb,
  layout jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT user_dashboard_settings_user_id_key UNIQUE (user_id)
);

-- Create index for better performance
CREATE INDEX user_dashboard_settings_user_id_idx ON user_dashboard_settings(user_id);

-- Enable RLS
ALTER TABLE user_dashboard_settings ENABLE ROW LEVEL SECURITY;

-- Create policy
CREATE POLICY "Users can manage their own dashboard settings"
  ON user_dashboard_settings
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Create function to initialize dashboard settings
CREATE OR REPLACE FUNCTION initialize_dashboard_settings()
RETURNS trigger
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO user_dashboard_settings (
    user_id,
    widgets,
    layout
  ) VALUES (
    NEW.id,
    '[
      {"type": "active_tasks", "size": "large"},
      {"type": "upcoming_deadlines", "size": "medium"},
      {"type": "quick_task", "size": "small"},
      {"type": "task_stats", "size": "medium"}
    ]'::jsonb,
    '{
      "lg": [
        {"i": "active_tasks", "x": 0, "y": 0, "w": 12, "h": 3},
        {"i": "upcoming_deadlines", "x": 0, "y": 3, "w": 6, "h": 3},
        {"i": "quick_task", "x": 6, "y": 3, "w": 6, "h": 3},
        {"i": "task_stats", "x": 0, "y": 6, "w": 12, "h": 3}
      ]
    }'::jsonb
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Create trigger to initialize settings for new users
CREATE TRIGGER initialize_dashboard_settings_trigger
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION initialize_dashboard_settings();

-- Initialize settings for existing users
INSERT INTO user_dashboard_settings (
  user_id,
  widgets,
  layout
)
SELECT 
  id as user_id,
  '[
    {"type": "active_tasks", "size": "large"},
    {"type": "upcoming_deadlines", "size": "medium"},
    {"type": "quick_task", "size": "small"},
    {"type": "task_stats", "size": "medium"}
  ]'::jsonb as widgets,
  '{
    "lg": [
      {"i": "active_tasks", "x": 0, "y": 0, "w": 12, "h": 3},
      {"i": "upcoming_deadlines", "x": 0, "y": 3, "w": 6, "h": 3},
      {"i": "quick_task", "x": 6, "y": 3, "w": 6, "h": 3},
      {"i": "task_stats", "x": 0, "y": 6, "w": 12, "h": 3}
    ]
  }'::jsonb as layout
FROM auth.users
ON CONFLICT (user_id) DO NOTHING;