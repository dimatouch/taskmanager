/*
  # Development Permissions

  This migration updates RLS policies to be more permissive during development.
  
  1. Changes
    - Enables full access to all tables for authenticated users
    - Simplifies policies to reduce authentication checks
    - Makes all operations available to any authenticated user
  
  2. Tables Affected
    - tasks
    - task_statuses
    - task_assignees
    - task_activities
    - projects
    - boards
    - lists
    - cards
    - board_members
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view all tasks" ON tasks;
DROP POLICY IF EXISTS "Users can create their own tasks" ON tasks;
DROP POLICY IF EXISTS "Users can update any task" ON tasks;
DROP POLICY IF EXISTS "Users can delete their own tasks" ON tasks;

DROP POLICY IF EXISTS "Everyone can view task statuses" ON task_statuses;

DROP POLICY IF EXISTS "assignees_select" ON task_assignees;
DROP POLICY IF EXISTS "assignees_insert" ON task_assignees;
DROP POLICY IF EXISTS "assignees_delete" ON task_assignees;

DROP POLICY IF EXISTS "Users can view task activities" ON task_activities;
DROP POLICY IF EXISTS "Users can create task activities" ON task_activities;
DROP POLICY IF EXISTS "Users can delete task activities" ON task_activities;

DROP POLICY IF EXISTS "project_select" ON projects;
DROP POLICY IF EXISTS "project_insert" ON projects;
DROP POLICY IF EXISTS "project_update" ON projects;
DROP POLICY IF EXISTS "project_delete" ON projects;

-- Create new permissive policies for tasks
CREATE POLICY "Full access to tasks"
  ON tasks
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create new permissive policies for task_statuses
CREATE POLICY "Full access to task statuses"
  ON task_statuses
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create new permissive policies for task_assignees
CREATE POLICY "Full access to task assignees"
  ON task_assignees
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create new permissive policies for task_activities
CREATE POLICY "Full access to task activities"
  ON task_activities
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create new permissive policies for projects
CREATE POLICY "Full access to projects"
  ON projects
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);