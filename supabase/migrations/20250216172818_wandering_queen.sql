-- Create company_registration_settings table
CREATE TABLE company_registration_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  allow_public_registration boolean DEFAULT false,
  require_approval boolean DEFAULT true,
  allowed_email_domains text[] DEFAULT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create company_registration_requests table
CREATE TABLE company_registration_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  status text NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')),
  requested_at timestamptz DEFAULT now(),
  processed_at timestamptz,
  processed_by uuid REFERENCES auth.users(id),
  notes text
);

-- Create indexes for better performance
CREATE INDEX company_registration_settings_company_id_idx 
  ON company_registration_settings(company_id);
CREATE INDEX company_registration_requests_company_id_idx 
  ON company_registration_requests(company_id);
CREATE INDEX company_registration_requests_user_id_idx 
  ON company_registration_requests(user_id);
CREATE INDEX company_registration_requests_status_idx 
  ON company_registration_requests(status);

-- Enable RLS
ALTER TABLE company_registration_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_registration_requests ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Company admins can manage registration settings"
  ON company_registration_settings
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_id = company_registration_settings.company_id
      AND user_id = auth.uid()
      AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Users can view registration settings"
  ON company_registration_settings
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create registration requests"
  ON company_registration_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid() AND
    status = 'pending' AND
    NOT EXISTS (
      SELECT 1 FROM company_registration_requests
      WHERE company_id = company_registration_requests.company_id
      AND user_id = auth.uid()
      AND status = 'pending'
    )
  );

CREATE POLICY "Users can view their own requests"
  ON company_registration_requests
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_id = company_registration_requests.company_id
      AND user_id = auth.uid()
      AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Admins can manage registration requests"
  ON company_registration_requests
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE company_id = company_registration_requests.company_id
      AND user_id = auth.uid()
      AND role IN ('owner', 'admin')
    )
  );

-- Create function to handle registration request approval
CREATE OR REPLACE FUNCTION approve_registration_request(request_id uuid)
RETURNS boolean AS $$
DECLARE
  v_request company_registration_requests%ROWTYPE;
  v_user_id uuid;
BEGIN
  -- Get current user
  SELECT auth.uid() INTO v_user_id;
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No authenticated user';
  END IF;

  -- Get request
  SELECT * INTO v_request
  FROM company_registration_requests
  WHERE id = request_id
  AND status = 'pending';

  IF v_request.id IS NULL THEN
    RETURN false;
  END IF;

  -- Verify admin rights
  IF NOT EXISTS (
    SELECT 1 FROM company_members
    WHERE company_id = v_request.company_id
    AND user_id = v_user_id
    AND role IN ('owner', 'admin')
  ) THEN
    RETURN false;
  END IF;

  -- Update request status
  UPDATE company_registration_requests
  SET 
    status = 'approved',
    processed_at = now(),
    processed_by = v_user_id
  WHERE id = request_id;

  -- Add user to company
  INSERT INTO company_members (company_id, user_id, role)
  VALUES (v_request.company_id, v_request.user_id, 'member')
  ON CONFLICT (company_id, user_id) DO NOTHING;

  -- Set as current company if user has none
  UPDATE user_profiles
  SET current_company_id = v_request.company_id
  WHERE user_id = v_request.user_id
  AND current_company_id IS NULL;

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to handle registration request rejection
CREATE OR REPLACE FUNCTION reject_registration_request(request_id uuid, rejection_notes text DEFAULT NULL)
RETURNS boolean AS $$
DECLARE
  v_request company_registration_requests%ROWTYPE;
  v_user_id uuid;
BEGIN
  -- Get current user
  SELECT auth.uid() INTO v_user_id;
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No authenticated user';
  END IF;

  -- Get request
  SELECT * INTO v_request
  FROM company_registration_requests
  WHERE id = request_id
  AND status = 'pending';

  IF v_request.id IS NULL THEN
    RETURN false;
  END IF;

  -- Verify admin rights
  IF NOT EXISTS (
    SELECT 1 FROM company_members
    WHERE company_id = v_request.company_id
    AND user_id = v_user_id
    AND role IN ('owner', 'admin')
  ) THEN
    RETURN false;
  END IF;

  -- Update request status
  UPDATE company_registration_requests
  SET 
    status = 'rejected',
    processed_at = now(),
    processed_by = v_user_id,
    notes = rejection_notes
  WHERE id = request_id;

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to check if email domain is allowed
CREATE OR REPLACE FUNCTION is_email_domain_allowed(p_company_id uuid, p_email text)
RETURNS boolean AS $$
DECLARE
  v_settings company_registration_settings%ROWTYPE;
  v_domain text;
BEGIN
  -- Get company settings
  SELECT * INTO v_settings
  FROM company_registration_settings
  WHERE company_id = p_company_id;

  -- If no settings or no domain restrictions, allow
  IF v_settings.id IS NULL OR v_settings.allowed_email_domains IS NULL THEN
    RETURN true;
  END IF;

  -- Extract domain from email
  v_domain := split_part(p_email, '@', 2);

  -- Check if domain is in allowed list
  RETURN v_domain = ANY(v_settings.allowed_email_domains);
END;
$$ LANGUAGE plpgsql;

-- Create function to handle new user registration
CREATE OR REPLACE FUNCTION handle_new_user_registration()
RETURNS trigger AS $$
BEGIN
  -- Create user profile
  INSERT INTO user_profiles (user_id, email, first_name, last_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', '')
  );

  -- If company_id is provided in metadata, create registration request
  IF NEW.raw_user_meta_data->>'company_id' IS NOT NULL THEN
    INSERT INTO company_registration_requests (
      company_id,
      user_id,
      status
    ) VALUES (
      (NEW.raw_user_meta_data->>'company_id')::uuid,
      NEW.id,
      CASE 
        WHEN EXISTS (
          SELECT 1 FROM company_registration_settings
          WHERE company_id = (NEW.raw_user_meta_data->>'company_id')::uuid
          AND require_approval = false
        ) THEN 'approved'
        ELSE 'pending'
      END
    );
  END IF;

  -- Make first user admin if no roles exist
  IF NOT EXISTS (SELECT 1 FROM user_roles) THEN
    INSERT INTO user_roles (user_id, role, created_by, is_admin)
    VALUES (NEW.id, 'admin', NEW.id, true);
  ELSE
    -- For users created through admin panel, use the role from metadata
    INSERT INTO user_roles (user_id, role, created_by, is_admin)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'role', 'user'),
      COALESCE((NEW.raw_user_meta_data->>'created_by')::uuid, NEW.id),
      COALESCE((NEW.raw_user_meta_data->>'role')::text = 'admin', false)
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger
DROP TRIGGER IF EXISTS handle_new_user_trigger ON auth.users;

-- Create new trigger for user registration
CREATE TRIGGER handle_new_user_registration_trigger
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user_registration();

-- Initialize registration settings for existing companies
INSERT INTO company_registration_settings (company_id)
SELECT id FROM companies
WHERE NOT EXISTS (
  SELECT 1 FROM company_registration_settings
  WHERE company_id = companies.id
);