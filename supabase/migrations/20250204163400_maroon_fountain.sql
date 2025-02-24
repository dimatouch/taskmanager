/*
  # Unify activities and comments

  1. Changes
    - Add 'comment' and 'progress' to task_activities type check
    - Migrate existing comments to task_activities
    - Drop task_comments table
    
  2. Data Migration
    - All existing comments will be preserved as activities
    - Comment content will be stored in new_value
    - Original timestamps will be maintained
*/

-- Update type check for task_activities
ALTER TABLE task_activities 
DROP CONSTRAINT IF EXISTS task_activities_type_check;

ALTER TABLE task_activities 
ADD CONSTRAINT task_activities_type_check 
CHECK (type IN ('update', 'create', 'delete', 'comment', 'progress'));

-- Migrate existing comments to activities
INSERT INTO task_activities (
  task_id,
  user_id,
  type,
  field,
  new_value,
  created_at
)
SELECT 
  task_id,
  user_id,
  type,
  'comment',
  content,
  created_at
FROM task_comments;

-- Drop task_comments table
DROP TABLE task_comments;