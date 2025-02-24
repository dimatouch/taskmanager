-- Create company_registration_settings table
CREATE TABLE company_registration_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  allow_public_registration boolean DEFAULT false,
  require_approval boolean DEFAULT true,
  allowed_email_domains text[] DEFAULT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT company_registration_settings_company_id_key UNIQUE (company_id)
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
CREATE POLICY "Full access to registration settings"
  ON company_registration_settings
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Full access to registration requests"
  ON company_registration_requests
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create view for company registration request profiles
CREATE OR REPLACE VIEW company_registration_request_profiles AS
SELECT 
  crr.id,
  crr.company_id,
  crr.user_id,
  crr.status,
  crr.requested_at,
  crr.processed_at,
  crr.processed_by,
  crr.notes,
  up.email,
  up.first_name,
  up.last_name
FROM company_registration_requests crr
JOIN user_profiles up ON up.user_id = crr.user_id;

-- Initialize settings for existing companies
INSERT INTO company_registration_settings (company_id)
SELECT id FROM companies
ON CONFLICT (company_id) DO NOTHING;