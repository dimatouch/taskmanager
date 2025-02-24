-- Create view for company registration requests with user profiles
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

-- Drop existing policies
DROP POLICY IF EXISTS "Company members can access task activities" ON task_activities;

-- Create new permissive policy
CREATE POLICY "Full access to task activities"
  ON task_activities
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);