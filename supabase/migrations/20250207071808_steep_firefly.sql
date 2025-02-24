/*
  # Update task status colors
  
  Updates the colors of task statuses to use more vibrant and modern colors.

  1. Changes
    - To Do: Indigo (#6366F1)
    - In Progress: Amber (#F59E0B) 
    - Review: Purple (#8B5CF6)
    - Done: Emerald (#10B981)
*/

UPDATE task_statuses 
SET color = CASE name
  WHEN 'To Do' THEN '#6366F1'      -- Indigo
  WHEN 'In Progress' THEN '#F59E0B' -- Amber
  WHEN 'Review' THEN '#8B5CF6'      -- Purple
  WHEN 'Done' THEN '#10B981'        -- Emerald
END
WHERE name IN ('To Do', 'In Progress', 'Review', 'Done');