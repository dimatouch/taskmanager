-- Drop existing objects first
DROP TRIGGER IF EXISTS initialize_calendar_settings_trigger ON auth.users CASCADE;
DROP FUNCTION IF EXISTS initialize_calendar_settings() CASCADE;

-- Drop and recreate calendar_settings table
DROP TABLE IF EXISTS calendar_settings CASCADE;

-- Create calendar_settings table
CREATE TABLE calendar_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  google_refresh_token text,
  google_calendar_id text,
  auto_sync boolean DEFAULT false,
  default_reminder_minutes integer DEFAULT 30,
  sync_description boolean DEFAULT true,
  sync_status text DEFAULT 'disconnected',
  last_sync_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT calendar_settings_user_id_unique UNIQUE (user_id)
);

-- Create index for better performance
CREATE INDEX calendar_settings_user_id_idx ON calendar_settings(user_id);

-- Enable RLS
ALTER TABLE calendar_settings ENABLE ROW LEVEL SECURITY;

-- Create maximally permissive policy for authenticated users
CREATE POLICY "Authenticated users can manage calendar settings"
  ON calendar_settings
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Create function to initialize calendar settings
CREATE OR REPLACE FUNCTION initialize_calendar_settings()
RETURNS trigger
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
  -- Always attempt to create settings for new user
  INSERT INTO calendar_settings (user_id)
  VALUES (NEW.id)
  ON CONFLICT ON CONSTRAINT calendar_settings_user_id_unique DO NOTHING;
  
  RETURN NEW;
END;
$$;

-- Create trigger to initialize settings for new users
CREATE TRIGGER initialize_calendar_settings_trigger
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION initialize_calendar_settings();

-- Initialize settings for existing users
INSERT INTO calendar_settings (user_id)
SELECT id FROM auth.users
ON CONFLICT ON CONSTRAINT calendar_settings_user_id_unique DO NOTHING;