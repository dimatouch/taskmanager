-- Drop existing objects first
DROP TRIGGER IF EXISTS initialize_calendar_settings_trigger ON auth.users CASCADE;
DROP FUNCTION IF EXISTS initialize_calendar_settings() CASCADE;

-- Drop and recreate calendar_settings table
DROP TABLE IF EXISTS calendar_settings CASCADE;

-- Create calendar_settings table
CREATE TABLE calendar_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  google_refresh_token text,
  google_calendar_id text,
  auto_sync boolean DEFAULT false,
  default_reminder_minutes integer DEFAULT 30,
  sync_description boolean DEFAULT true,
  sync_status text DEFAULT 'disconnected',
  last_sync_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create index for better performance
CREATE INDEX calendar_settings_user_id_idx ON calendar_settings(user_id);

-- Enable RLS
ALTER TABLE calendar_settings ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can manage their own calendar settings"
  ON calendar_settings
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Create function to initialize calendar settings
CREATE OR REPLACE FUNCTION initialize_calendar_settings()
RETURNS trigger AS $$
BEGIN
  INSERT INTO calendar_settings (user_id)
  VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to initialize settings for new users
CREATE TRIGGER initialize_calendar_settings_trigger
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION initialize_calendar_settings();

-- Initialize settings for existing users
INSERT INTO calendar_settings (user_id)
SELECT id FROM auth.users
WHERE NOT EXISTS (
  SELECT 1 FROM calendar_settings 
  WHERE calendar_settings.user_id = auth.users.id
);