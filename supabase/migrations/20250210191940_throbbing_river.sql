/*
  # Fix viewer query implementation
  
  1. Changes
    - Drops references to deprecated task_viewers table
    - Updates viewer query to use task_roles table
    - Adds logging for better debugging
    - Ensures consistent viewer role handling
  
  2. Notes
    - Removes ambiguity between task_viewers and task_roles
    - Provides better visibility into query execution
*/

-- Drop any remaining references to task_viewers
DROP TABLE IF EXISTS task_viewers;

-- Drop existing function
DROP FUNCTION IF EXISTS get_viewer_only_tasks(uuid);

-- Create improved function to get viewer-only tasks
CREATE OR REPLACE FUNCTION get_viewer_only_tasks(p_user_id uuid)
RETURNS SETOF tasks AS $$
DECLARE
  v_count integer;
BEGIN
  -- Log start of query
  RAISE NOTICE 'Fetching viewer-only tasks for user: %', p_user_id;
  
  -- Get count of matching tasks before query
  SELECT COUNT(DISTINCT t.id)
  INTO v_count
  FROM tasks t
  JOIN task_roles tr ON tr.task_id = t.id
  WHERE tr.user_id = p_user_id
  AND tr.role = 'viewer'
  AND NOT EXISTS (
    SELECT 1 FROM task_roles tr2
    WHERE tr2.task_id = t.id
    AND tr2.user_id = p_user_id
    AND tr2.role != 'viewer'
  );
  
  RAISE NOTICE 'Found % tasks where user is viewer-only', v_count;

  -- Return tasks where user is ONLY a viewer
  RETURN QUERY
  SELECT DISTINCT t.*
  FROM tasks t
  JOIN task_roles tr ON tr.task_id = t.id
  WHERE tr.user_id = p_user_id
  AND tr.role = 'viewer'
  -- Ensure user doesn't have any other roles for this task
  AND NOT EXISTS (
    SELECT 1 FROM task_roles tr2
    WHERE tr2.task_id = t.id
    AND tr2.user_id = p_user_id
    AND tr2.role != 'viewer'
  )
  ORDER BY t.created_at DESC;
  
  -- Log completion
  RAISE NOTICE 'Query completed successfully';
END;
$$ LANGUAGE plpgsql;