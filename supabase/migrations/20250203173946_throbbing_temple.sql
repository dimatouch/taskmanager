/*
  # Add task results and enhance comments

  1. Changes
    - Add result field to tasks table for storing final task outcomes
    - Add type field to task_comments for distinguishing between regular comments and progress updates
*/

-- Add result field to tasks
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS result text;

-- Add type field to task_comments
ALTER TABLE task_comments ADD COLUMN IF NOT EXISTS type text DEFAULT 'comment' CHECK (type IN ('comment', 'progress'));