/*
  # Improve Task Change Tracking

  1. New Tables
    - `task_change_types`: Defines valid change types
    - `task_field_types`: Defines valid field types
    - `task_change_logs`: Tracks all changes to tasks with proper validation

  2. Changes
    - Add validation constraints
    - Add proper indexing
    - Add triggers for automatic tracking

  3. Security
    - Enable RLS
    - Add policies for secure access
*/

-- Create enum tables for better validation
CREATE TABLE task_change_types (
  type text PRIMARY KEY,
  description text NOT NULL
);

CREATE TABLE task_field_types (
  field text PRIMARY KEY,
  description text NOT NULL,
  validation_regex text
);

-- Insert valid types
INSERT INTO task_change_types (type, description) VALUES
  ('update', 'Field update'),
  ('create', 'Task creation'),
  ('delete', 'Task deletion'),
  ('comment', 'User comment'),
  ('progress', 'Progress update');

-- Insert valid fields
INSERT INTO task_field_types (field, description, validation_regex) VALUES
  ('title', 'Task title', '^.{1,100}$'),
  ('description', 'Task description', NULL),
  ('status', 'Task status', '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'),
  ('due_date', 'Due date', '^\d{4}-\d{2}-\d{2}$'),
  ('assignees', 'Task assignees', NULL),
  ('project', 'Project assignment', NULL),
  ('priority', 'Task priority', '^[0-3]$'),
  ('result', 'Task result', NULL),
  ('comment', 'User comment', NULL),
  ('progress', 'Progress update', NULL);

-- Create improved task change logs table
CREATE TABLE task_change_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid REFERENCES tasks(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  type text REFERENCES task_change_types(type) NOT NULL,
  field text REFERENCES task_field_types(field) NOT NULL,
  old_value text,
  new_value text,
  created_at timestamptz DEFAULT now() NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb
);

-- Create validation function
CREATE OR REPLACE FUNCTION validate_change_log_values()
RETURNS trigger AS $$
BEGIN
  -- Check if the field has a validation regex
  IF EXISTS (
    SELECT 1 FROM task_field_types
    WHERE field = NEW.field
    AND validation_regex IS NOT NULL
    AND (
      (NEW.old_value IS NOT NULL AND NEW.old_value !~ validation_regex) OR
      (NEW.new_value IS NOT NULL AND NEW.new_value !~ validation_regex)
    )
  ) THEN
    RAISE EXCEPTION 'Invalid value for field %', NEW.field;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for validation
CREATE TRIGGER validate_change_log_values_trigger
BEFORE INSERT OR UPDATE ON task_change_logs
FOR EACH ROW
EXECUTE FUNCTION validate_change_log_values();

-- Add indexes for better performance
CREATE INDEX task_change_logs_task_id_idx ON task_change_logs(task_id);
CREATE INDEX task_change_logs_user_id_idx ON task_change_logs(user_id);
CREATE INDEX task_change_logs_created_at_idx ON task_change_logs(created_at DESC);
CREATE INDEX task_change_logs_type_field_idx ON task_change_logs(type, field);

-- Enable RLS
ALTER TABLE task_change_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_change_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_field_types ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view change types"
  ON task_change_types
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can view field types"
  ON task_field_types
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can view task changes"
  ON task_change_logs
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create task changes"
  ON task_change_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Create function to validate and log changes
CREATE OR REPLACE FUNCTION log_task_change(
  p_task_id uuid,
  p_type text,
  p_field text,
  p_old_value text,
  p_new_value text,
  p_metadata jsonb DEFAULT NULL
) RETURNS uuid AS $$
DECLARE
  v_user_id uuid;
  v_change_id uuid;
BEGIN
  -- Get current user
  SELECT auth.uid() INTO v_user_id;
  
  -- Validate type and field
  IF NOT EXISTS (SELECT 1 FROM task_change_types WHERE type = p_type) THEN
    RAISE EXCEPTION 'Invalid change type: %', p_type;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM task_field_types WHERE field = p_field) THEN
    RAISE EXCEPTION 'Invalid field type: %', p_field;
  END IF;

  -- Insert change log
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
    v_user_id,
    p_type,
    p_field,
    p_old_value,
    p_new_value,
    COALESCE(p_metadata, '{}'::jsonb)
  ) RETURNING id INTO v_change_id;

  RETURN v_change_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;