/*
  # Add projects and comments support
  
  1. New Tables
    - `projects`
      - `id` (uuid, primary key)
      - `name` (text)
      - `description` (text, optional)
      - `owner_id` (uuid, references auth.users)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    - `task_comments`
      - `id` (uuid, primary key)
      - `task_id` (uuid, references tasks)
      - `user_id` (uuid, references auth.users)
      - `content` (text)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
  
  2. Changes
    - Add `project_id` column to tasks table
  
  3. Security
    - Enable RLS on new tables
    - Add policies for viewing, creating, updating, and deleting projects and comments
*/

-- Create projects table
CREATE TABLE projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  owner_id uuid REFERENCES auth.users(id) NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add project_id to tasks
DO $$ 
BEGIN 
  ALTER TABLE tasks ADD COLUMN project_id uuid REFERENCES projects(id);
EXCEPTION
  WHEN duplicate_column THEN NULL;
END $$;

-- Create task_comments table
CREATE TABLE task_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid REFERENCES tasks(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  content text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_comments ENABLE ROW LEVEL SECURITY;

-- Basic policies for projects
CREATE POLICY "project_select" ON projects FOR SELECT TO authenticated USING (true);
CREATE POLICY "project_insert" ON projects FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY "project_update" ON projects FOR UPDATE TO authenticated USING (owner_id = auth.uid());
CREATE POLICY "project_delete" ON projects FOR DELETE TO authenticated USING (owner_id = auth.uid());

-- Basic policies for comments
CREATE POLICY "comment_select" ON task_comments FOR SELECT TO authenticated USING (true);
CREATE POLICY "comment_insert" ON task_comments FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "comment_update" ON task_comments FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "comment_delete" ON task_comments FOR DELETE TO authenticated USING (user_id = auth.uid());