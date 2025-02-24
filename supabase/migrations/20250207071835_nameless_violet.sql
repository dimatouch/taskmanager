/*
  # Update task status colors
  
  Updates the colors of task statuses to use more vibrant and modern colors.
  Also ensures the statuses exist before updating them.

  1. Changes
    - To Do: Indigo (#6366F1)
    - In Progress: Amber (#F59E0B) 
    - Review: Purple (#8B5CF6)
    - Done: Emerald (#10B981)
*/

-- First ensure the statuses exist
INSERT INTO task_statuses (name, color, position)
SELECT 'To Do', '#6366F1', 1
WHERE NOT EXISTS (SELECT 1 FROM task_statuses WHERE name = 'To Do');

INSERT INTO task_statuses (name, color, position)
SELECT 'In Progress', '#F59E0B', 2
WHERE NOT EXISTS (SELECT 1 FROM task_statuses WHERE name = 'In Progress');

INSERT INTO task_statuses (name, color, position)
SELECT 'Review', '#8B5CF6', 3
WHERE NOT EXISTS (SELECT 1 FROM task_statuses WHERE name = 'Review');

INSERT INTO task_statuses (name, color, position)
SELECT 'Done', '#10B981', 4
WHERE NOT EXISTS (SELECT 1 FROM task_statuses WHERE name = 'Done');

-- Then update the colors
UPDATE task_statuses 
SET color = CASE name
  WHEN 'To Do' THEN '#6366F1'      -- Indigo
  WHEN 'In Progress' THEN '#F59E0B' -- Amber
  WHEN 'Review' THEN '#8B5CF6'      -- Purple
  WHEN 'Done' THEN '#10B981'        -- Emerald
END
WHERE name IN ('To Do', 'In Progress', 'Review', 'Done');