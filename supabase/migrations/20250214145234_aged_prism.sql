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

-- Create policy for inserting settings
CREATE POLICY "Allow users to insert their own settings"
  ON calendar_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Allow insert only if:
    -- 1. The user_id matches the authenticated user
    -- 2. No settings exist for this user yet
    user_id = auth.uid() AND
    NOT EXISTS (
      SELECT 1 FROM calendar_settings
      WHERE user_id = auth.uid()
    )
  );

-- Create policy for viewing settings
CREATE POLICY "Allow users to view their own settings"
  ON calendar_settings
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Create policy for updating settings
CREATE POLICY "Allow users to update their own settings"
  ON calendar_settings
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Create policy for deleting settings
CREATE POLICY "Allow users to delete their own settings"
  ON calendar_settings
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Create function to initialize calendar settings
CREATE OR REPLACE FUNCTION initialize_calendar_settings()
RETURNS trigger
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
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
    VALUES (NEW.id)
    ON CONFLICT ON CONSTRAINT calendar_settings_user_id_unique DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

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
  FOR v_user IN 
    SELECT id 
    FROM auth.users 
    WHERE NOT EXISTS (
      SELECT 1 FROM calendar_settings 
      WHERE user_id = auth.users.id
    )
  LOOP
    INSERT INTO calendar_settings (user_id)
    VALUES (v_user.id)
    ON CONFLICT ON CONSTRAINT calendar_settings_user_id_unique DO NOTHING;
  END LOOP;
END $$;