-- Drop existing user_dashboard_settings table
DROP TABLE IF EXISTS user_dashboard_settings CASCADE;

-- Create user_dashboard_settings table with company support
CREATE TABLE user_dashboard_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  widgets jsonb DEFAULT '[]'::jsonb,
  layout jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT user_dashboard_settings_user_company_key UNIQUE (user_id, company_id)
);

-- Create indexes for better performance
CREATE INDEX user_dashboard_settings_user_id_idx ON user_dashboard_settings(user_id);
CREATE INDEX user_dashboard_settings_company_id_idx ON user_dashboard_settings(company_id);

-- Enable RLS
ALTER TABLE user_dashboard_settings ENABLE ROW LEVEL SECURITY;

-- Create policy for user_dashboard_settings
CREATE POLICY "Users can manage their own dashboard settings"
  ON user_dashboard_settings
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Initialize settings for existing users and companies
INSERT INTO user_dashboard_settings (
  user_id,
  company_id,
  widgets,
  layout
)
SELECT 
  u.id as user_id,
  cm.company_id,
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
FROM auth.users u
JOIN company_members cm ON cm.user_id = u.id
ON CONFLICT ON CONSTRAINT user_dashboard_settings_user_company_key DO NOTHING;