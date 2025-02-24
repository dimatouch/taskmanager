-- Drop existing policies
DROP POLICY IF EXISTS "Users can view change types" ON task_change_types;
DROP POLICY IF EXISTS "Users can view field types" ON task_field_types;
DROP POLICY IF EXISTS "Users can view task changes" ON task_change_logs;
DROP POLICY IF EXISTS "Users can create task changes" ON task_change_logs;

-- Create new permissive policies
CREATE POLICY "Full access to change types"
  ON task_change_types
  FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Full access to field types"
  ON task_field_types
  FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Full access to task changes"
  ON task_change_logs
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Update log_task_change function to remove auth check
CREATE OR REPLACE FUNCTION log_task_change(
  p_task_id uuid,
  p_type text,
  p_field text,
  p_old_value text,
  p_new_value text,
  p_metadata jsonb DEFAULT NULL
) RETURNS uuid AS $$
DECLARE
  v_change_id uuid;
BEGIN
  -- Validate type and field
  IF NOT EXISTS (SELECT 1 FROM task_change_types WHERE type = p_type) THEN
    RAISE EXCEPTION 'Invalid change type: %', p_type;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM task_field_types WHERE field = p_field) THEN
    RAISE EXCEPTION 'Invalid field type: %', p_field;
  END IF;

  -- Insert change log without user_id check
  INSERT INTO task_change_logs (
    task_id,
    user_id,
    type,
    field,
    old_value,
    new_value,
    metadata
  ) VALUES (
    p_task_id,
    '00000000-0000-0000-0000-000000000001', -- Default user
    p_type,
    p_field,
    p_old_value,
    p_new_value,
    COALESCE(p_metadata, '{}'::jsonb)
  ) RETURNING id INTO v_change_id;

  RETURN v_change_id;
END;
$$ LANGUAGE plpgsql;