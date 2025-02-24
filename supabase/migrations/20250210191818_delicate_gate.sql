/*
  # Simplify viewer-only task query
  
  1. Changes
    - Simplifies get_viewer_only_tasks function to return all tasks where user has viewer role
    - Removes restrictive conditions to help debug viewer access issues
    - Adds logging for better visibility into query results
  
  2. Notes
    - This is a temporary simplification for testing
    - Additional conditions can be added back gradually after verifying basic functionality
*/

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS get_viewer_only_tasks(uuid);

-- Create simplified function to get viewer-only tasks
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
  AND tr.role = 'viewer';
  
  RAISE NOTICE 'Found % tasks with viewer role', v_count;

  -- Return tasks where user has viewer role
  RETURN QUERY
  SELECT DISTINCT t.*
  FROM tasks t
  JOIN task_roles tr ON tr.task_id = t.id
  WHERE tr.user_id = p_user_id
  AND tr.role = 'viewer'
  ORDER BY t.created_at DESC;
  
  -- Log completion
  RAISE NOTICE 'Query completed successfully';
END;
$$ LANGUAGE plpgsql;