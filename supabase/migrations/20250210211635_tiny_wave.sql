-- Drop existing objects
DROP MATERIALIZED VIEW IF EXISTS user_statistics;
DROP FUNCTION IF EXISTS refresh_user_statistics() CASCADE;

-- Create regular view for user statistics
CREATE VIEW user_statistics AS
WITH task_counts AS (
  SELECT
    u.user_id,
    COUNT(DISTINCT t.id) FILTER (WHERE t.owner_id = u.user_id) as created_tasks,
    COUNT(DISTINCT t.id) FILTER (WHERE t.responsible_id = u.user_id) as responsible_tasks,
    COUNT(DISTINCT t.id) FILTER (WHERE u.user_id = ANY(t.coworkers)) as coworker_tasks,
    COUNT(DISTINCT t.id) FILTER (
      WHERE t.owner_id = u.user_id 
      AND t.result IS NOT NULL
    ) as completed_tasks,
    COUNT(DISTINCT t.id) FILTER (
      WHERE t.responsible_id = u.user_id 
      AND t.result IS NOT NULL
    ) as completed_responsible_tasks,
    COUNT(DISTINCT t.id) FILTER (
      WHERE u.user_id = ANY(t.coworkers)
      AND t.result IS NOT NULL
    ) as completed_coworker_tasks,
    COUNT(DISTINCT t.id) FILTER (
      WHERE (t.responsible_id = u.user_id OR u.user_id = ANY(t.coworkers))
      AND t.due_date < CURRENT_DATE
      AND t.result IS NULL
    ) as overdue_tasks,
    COUNT(DISTINCT ta.id) FILTER (WHERE ta.user_id = u.user_id) as total_activities,
    COUNT(DISTINCT ta.id) FILTER (
      WHERE ta.user_id = u.user_id 
      AND ta.type = 'comment'
    ) as total_comments,
    COUNT(DISTINCT ta.id) FILTER (
      WHERE ta.user_id = u.user_id 
      AND ta.type = 'progress'
    ) as total_progress_updates
  FROM user_profiles u
  LEFT JOIN tasks t ON 
    t.owner_id = u.user_id OR 
    t.responsible_id = u.user_id OR 
    u.user_id = ANY(t.coworkers)
  LEFT JOIN task_activities ta ON ta.user_id = u.user_id
  GROUP BY u.user_id
)
SELECT
  up.user_id,
  up.email,
  up.first_name,
  up.last_name,
  up.created_at as joined_at,
  ur.role,
  ur.is_admin,
  COALESCE(tc.created_tasks, 0) as created_tasks,
  COALESCE(tc.responsible_tasks, 0) as responsible_tasks,
  COALESCE(tc.coworker_tasks, 0) as coworker_tasks,
  COALESCE(tc.completed_tasks, 0) as completed_tasks,
  COALESCE(tc.completed_responsible_tasks, 0) as completed_responsible_tasks,
  COALESCE(tc.completed_coworker_tasks, 0) as completed_coworker_tasks,
  COALESCE(tc.overdue_tasks, 0) as overdue_tasks,
  COALESCE(tc.total_activities, 0) as total_activities,
  COALESCE(tc.total_comments, 0) as total_comments,
  COALESCE(tc.total_progress_updates, 0) as total_progress_updates,
  CASE 
    WHEN COALESCE(tc.responsible_tasks, 0) > 0 THEN 
      ROUND((COALESCE(tc.completed_responsible_tasks, 0)::numeric / tc.responsible_tasks) * 100, 2)
    ELSE 0 
  END as completion_rate,
  CASE 
    WHEN COALESCE(tc.created_tasks, 0) > 0 THEN 
      ROUND((COALESCE(tc.completed_tasks, 0)::numeric / tc.created_tasks) * 100, 2)
    ELSE 0 
  END as created_completion_rate
FROM user_profiles up
LEFT JOIN user_roles ur ON ur.user_id = up.user_id
LEFT JOIN task_counts tc ON tc.user_id = up.user_id;

-- Grant permissions to authenticated users
GRANT SELECT ON user_statistics TO authenticated;