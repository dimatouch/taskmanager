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
DECLARE
  v_count integer;
BEGIN
  -- Check if user already has settings
  SELECT COUNT(*) INTO v_count
  FROM calendar_settings
  WHERE user_id = NEW.id;

  -- Only insert if no settings exist
  IF v_count = 0 THEN
    INSERT INTO calendar_settings (user_id)
    VALUES (NEW.id);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to initialize settings for new users
CREATE TRIGGER initialize_calendar_settings_trigger
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION initialize_calendar_settings();

-- Initialize settings for existing users
DO $$ 
DECLARE
  v_user RECORD;
BEGIN
  FOR v_user IN SELECT id FROM auth.users
  LOOP
    BEGIN
      INSERT INTO calendar_settings (user_id)
      VALUES (v_user.id)
      ON CONFLICT ON CONSTRAINT calendar_settings_user_id_unique DO NOTHING;
    EXCEPTION
      WHEN unique_violation THEN
        -- Skip if already exists
        NULL;
    END;
  END LOOP;
END $$;