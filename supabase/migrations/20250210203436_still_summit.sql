/*
  # Create User Statistics View

  1. New Objects
    - `user_statistics` materialized view
      - Aggregates user statistics from tasks and related tables
      - Includes task counts, completion rates, and activity metrics
      - Auto-refreshes when underlying data changes

  2. Changes
    - Creates function to refresh statistics
    - Adds triggers to keep statistics up to date
*/

-- Create materialized view for user statistics
CREATE MATERIALIZED VIEW user_statistics AS
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
  tc.created_tasks,
  tc.responsible_tasks,
  tc.coworker_tasks,
  tc.completed_tasks,
  tc.completed_responsible_tasks,
  tc.completed_coworker_tasks,
  tc.overdue_tasks,
  tc.total_activities,
  tc.total_comments,
  tc.total_progress_updates,
  CASE 
    WHEN tc.responsible_tasks > 0 THEN 
      ROUND((tc.completed_responsible_tasks::numeric / tc.responsible_tasks) * 100, 2)
    ELSE 0 
  END as completion_rate,
  CASE 
    WHEN tc.created_tasks > 0 THEN 
      ROUND((tc.completed_tasks::numeric / tc.created_tasks) * 100, 2)
    ELSE 0 
  END as created_completion_rate
FROM user_profiles up
LEFT JOIN user_roles ur ON ur.user_id = up.user_id
LEFT JOIN task_counts tc ON tc.user_id = up.user_id;

-- Create index for better query performance
CREATE UNIQUE INDEX user_statistics_user_id_idx ON user_statistics(user_id);

-- Create function to refresh statistics
CREATE OR REPLACE FUNCTION refresh_user_statistics()
RETURNS trigger AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY user_statistics;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create triggers to refresh statistics when data changes
CREATE TRIGGER refresh_stats_on_task_change
  AFTER INSERT OR UPDATE OR DELETE ON tasks
  FOR EACH STATEMENT
  EXECUTE FUNCTION refresh_user_statistics();

CREATE TRIGGER refresh_stats_on_activity_change
  AFTER INSERT OR UPDATE OR DELETE ON task_activities
  FOR EACH STATEMENT
  EXECUTE FUNCTION refresh_user_statistics();

-- Initial refresh
REFRESH MATERIALIZED VIEW user_statistics;