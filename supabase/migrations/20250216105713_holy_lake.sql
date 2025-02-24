-- Drop existing policies
DROP POLICY IF EXISTS "Users can view companies they belong to" ON companies;
DROP POLICY IF EXISTS "Company owners can manage company" ON companies;
DROP POLICY IF EXISTS "Users can view company members" ON company_members;
DROP POLICY IF EXISTS "Company admins can manage members" ON company_members;
DROP POLICY IF EXISTS "Users can view company projects" ON projects;
DROP POLICY IF EXISTS "Users can view company tasks" ON tasks;
DROP POLICY IF EXISTS "Users can view company task statuses" ON task_statuses;

-- Create simplified policies without recursion
CREATE POLICY "View companies"
  ON companies
  FOR SELECT
  TO authenticated
  USING (
    owner_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_id = companies.id
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Manage companies"
  ON companies
  FOR ALL
  TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "View company members"
  ON company_members
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM companies
      WHERE id = company_members.company_id
      AND (
        owner_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM company_members cm
          WHERE cm.company_id = companies.id
          AND cm.user_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "Manage company members"
  ON company_members
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM companies
      WHERE id = company_members.company_id
      AND owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM companies
      WHERE id = company_members.company_id
      AND owner_id = auth.uid()
    )
  );

-- Create policies for company-scoped resources
CREATE POLICY "View company projects"
  ON projects
  FOR SELECT
  TO authenticated
  USING (
    company_id IS NULL OR
    EXISTS (
      SELECT 1 FROM companies
      WHERE id = projects.company_id
      AND (
        owner_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM company_members
          WHERE company_id = companies.id
          AND user_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "View company tasks"
  ON tasks
  FOR SELECT
  TO authenticated
  USING (
    company_id IS NULL OR
    EXISTS (
      SELECT 1 FROM companies
      WHERE id = tasks.company_id
      AND (
        owner_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM company_members
          WHERE company_id = companies.id
          AND user_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "View company task statuses"
  ON task_statuses
  FOR SELECT
  TO authenticated
  USING (
    company_id IS NULL OR
    EXISTS (
      SELECT 1 FROM companies
      WHERE id = task_statuses.company_id
      AND (
        owner_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM company_members
          WHERE company_id = companies.id
          AND user_id = auth.uid()
        )
      )
    )
  );

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS company_members_company_user_idx ON company_members(company_id, user_id);
CREATE INDEX IF NOT EXISTS companies_owner_idx ON companies(owner_id);
CREATE INDEX IF NOT EXISTS projects_company_idx ON projects(company_id);
CREATE INDEX IF NOT EXISTS tasks_company_idx ON tasks(company_id);
CREATE INDEX IF NOT EXISTS task_statuses_company_idx ON task_statuses(company_id);