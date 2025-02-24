-- Create companies table
CREATE TABLE companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  logo_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  owner_id uuid REFERENCES auth.users(id) NOT NULL
);

-- Create company members table
CREATE TABLE company_members (
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('owner', 'admin', 'member')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  PRIMARY KEY (company_id, user_id)
);

-- Add company_id to existing tables
ALTER TABLE projects ADD COLUMN company_id uuid REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE tasks ADD COLUMN company_id uuid REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE task_statuses ADD COLUMN company_id uuid REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE user_profiles ADD COLUMN current_company_id uuid REFERENCES companies(id);

-- Create indexes
CREATE INDEX company_members_user_id_idx ON company_members(user_id);
CREATE INDEX projects_company_id_idx ON projects(company_id);
CREATE INDEX tasks_company_id_idx ON tasks(company_id);
CREATE INDEX task_statuses_company_id_idx ON task_statuses(company_id);

-- Enable RLS
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_members ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view companies they belong to"
  ON companies
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_id = companies.id
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Company owners can manage company"
  ON companies
  FOR ALL
  TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can view company members"
  ON company_members
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM company_members cm
      WHERE cm.company_id = company_members.company_id
      AND cm.user_id = auth.uid()
    )
  );

CREATE POLICY "Company admins can manage members"
  ON company_members
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_id = company_members.company_id
      AND user_id = auth.uid()
      AND role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_id = company_members.company_id
      AND user_id = auth.uid()
      AND role IN ('owner', 'admin')
    )
  );

-- Update existing policies to include company_id check
CREATE POLICY "Users can view company projects"
  ON projects
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_id = projects.company_id
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view company tasks"
  ON tasks
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_id = tasks.company_id
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view company task statuses"
  ON task_statuses
  FOR SELECT
  TO authenticated
  USING (
    company_id IS NULL OR
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_id = task_statuses.company_id
      AND user_id = auth.uid()
    )
  );