-- Drop existing calendar_settings table
DROP TABLE IF EXISTS calendar_settings CASCADE;

-- Create calendar_settings table with proper fields
CREATE TABLE calendar_settings (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  google_refresh_token text,
  google_calendar_id text,
  auto_sync boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE calendar_settings ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can manage their own calendar settings"
  ON calendar_settings
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());