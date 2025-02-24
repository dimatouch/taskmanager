-- Create view for company member profiles
CREATE OR REPLACE VIEW company_member_profiles AS
SELECT 
  cm.company_id,
  cm.user_id,
  cm.role,
  up.email,
  up.first_name,
  up.last_name,
  up.created_at
FROM company_members cm
JOIN user_profiles up ON up.user_id = cm.user_id;

-- Create function to get company users
CREATE OR REPLACE FUNCTION get_company_users(p_company_id uuid)
RETURNS TABLE (
  id uuid,
  email text,
  first_name text,
  last_name text,
  role text
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cm.user_id as id,
    up.email,
    up.first_name,
    up.last_name,
    cm.role
  FROM company_members cm
  JOIN user_profiles up ON up.user_id = cm.user_id
  WHERE cm.company_id = p_company_id
  ORDER BY up.email;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT SELECT ON company_member_profiles TO authenticated;
GRANT EXECUTE ON FUNCTION get_company_users(uuid) TO authenticated;

-- Create function to initialize dashboard settings
CREATE OR REPLACE FUNCTION initialize_dashboard_settings()
RETURNS trigger AS $$
DECLARE
  default_widgets jsonb := '[
    {"type": "active_tasks", "size": "large"},
    {"type": "upcoming_deadlines", "size": "medium"},
    {"type": "quick_task", "size": "small"},
    {"type": "task_stats", "size": "medium"}
  ]'::jsonb;
  
  default_layout jsonb := '{
    "lg": [
      {"i": "active_tasks", "x": 0, "y": 0, "w": 12, "h": 3},
      {"i": "upcoming_deadlines", "x": 0, "y": 3, "w": 6, "h": 3},
      {"i": "quick_task", "x": 6, "y": 3, "w": 6, "h": 3},
      {"i": "task_stats", "x": 0, "y": 6, "w": 12, "h": 3}
    ]
  }'::jsonb;
BEGIN
  -- Create dashboard settings for new user
  INSERT INTO user_dashboard_settings (
    user_id,
    widgets,
    layout
  ) VALUES (
    NEW.id,
    default_widgets,
    default_layout
  )
  ON CONFLICT (user_id) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for dashboard settings initialization
DROP TRIGGER IF EXISTS initialize_dashboard_settings_trigger ON auth.users;
CREATE TRIGGER initialize_dashboard_settings_trigger
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION initialize_dashboard_settings();

-- Initialize dashboard settings for existing users
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