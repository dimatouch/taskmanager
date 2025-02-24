-- Drop existing policies first
DROP POLICY IF EXISTS "Full access to tasks" ON tasks;
DROP POLICY IF EXISTS "Full access to task statuses" ON task_statuses;
DROP POLICY IF EXISTS "Full access to projects" ON projects;
DROP POLICY IF EXISTS "View companies" ON companies;
DROP POLICY IF EXISTS "Manage companies" ON companies;
DROP POLICY IF EXISTS "View company members" ON company_members;
DROP POLICY IF EXISTS "Manage company members" ON company_members;
DROP POLICY IF EXISTS "View company projects" ON projects;
DROP POLICY IF EXISTS "View company tasks" ON tasks;
DROP POLICY IF EXISTS "View company task statuses" ON task_statuses;

-- Create Touch company if it doesn't exist
INSERT INTO companies (name, slug, owner_id)
SELECT 
  'Touch', 
  'touch',
  (SELECT id FROM auth.users ORDER BY created_at ASC LIMIT 1)
WHERE NOT EXISTS (
  SELECT 1 FROM companies WHERE slug = 'touch'
);

-- Get Touch company ID
WITH touch_company AS (
  SELECT id FROM companies WHERE slug = 'touch'
)
-- Add all users as members of Touch company
INSERT INTO company_members (company_id, user_id, role)
SELECT 
  (SELECT id FROM touch_company),
  u.id,
  CASE 
    WHEN ur.is_admin THEN 'admin'
    ELSE 'member'
  END
FROM auth.users u
LEFT JOIN user_roles ur ON ur.user_id = u.id
WHERE NOT EXISTS (
  SELECT 1 FROM company_members cm 
  WHERE cm.company_id = (SELECT id FROM touch_company)
  AND cm.user_id = u.id
);

-- Set Touch as current company for all users
WITH touch_company AS (
  SELECT id FROM companies WHERE slug = 'touch'
)
UPDATE user_profiles
SET current_company_id = (SELECT id FROM touch_company)
WHERE current_company_id IS NULL;

-- Create simplified policies
CREATE POLICY "Full access to companies"
  ON companies
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Full access to company members"
  ON company_members
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Full access to projects"
  ON projects
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Full access to tasks"
  ON tasks
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Full access to task statuses"
  ON task_statuses
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Update all existing tasks and projects to belong to Touch company
WITH touch_company AS (
  SELECT id FROM companies WHERE slug = 'touch'
)
UPDATE tasks
SET company_id = (SELECT id FROM touch_company)
WHERE company_id IS NULL;

WITH touch_company AS (
  SELECT id FROM companies WHERE slug = 'touch'
)
UPDATE projects
SET company_id = (SELECT id FROM touch_company)
WHERE company_id IS NULL;

WITH touch_company AS (
  SELECT id FROM companies WHERE slug = 'touch'
)
UPDATE task_statuses
SET company_id = (SELECT id FROM touch_company)
WHERE company_id IS NULL;