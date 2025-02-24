/*
  # Add task priority field

  1. Changes
    - Add priority field to tasks table with values 0-3
      - 0: No priority
      - 1: Low priority (1 flame)
      - 2: Medium priority (2 flames)
      - 3: High priority (3 flames)
*/

ALTER TABLE tasks
ADD COLUMN priority smallint DEFAULT 0 CHECK (priority >= 0 AND priority <= 3);