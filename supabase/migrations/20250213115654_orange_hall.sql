-- Drop existing policies first to avoid conflicts
DROP POLICY IF EXISTS "Users can manage their own calendar settings" ON calendar_settings;

-- Create calendar_settings table if it doesn't exist
CREATE TABLE IF NOT EXISTS calendar_settings (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  google_refresh_token text,
  google_calendar_id text,
  auto_sync boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add calendar fields to tasks if they don't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tasks' AND column_name = 'calendar_event_id'
  ) THEN
    ALTER TABLE tasks ADD COLUMN calendar_event_id text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tasks' AND column_name = 'calendar_synced_at'
  ) THEN
    ALTER TABLE tasks ADD COLUMN calendar_synced_at timestamptz;
  END IF;
END $$;

-- Enable RLS
ALTER TABLE calendar_settings ENABLE ROW LEVEL SECURITY;

-- Create new policy with a unique name
CREATE POLICY "calendar_settings_user_policy"
  ON calendar_settings
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Create function to update calendar_synced_at
CREATE OR REPLACE FUNCTION update_calendar_synced_at()
RETURNS trigger AS $$
BEGIN
  NEW.calendar_synced_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for calendar sync
DROP TRIGGER IF EXISTS update_calendar_synced_at_trigger ON tasks;
CREATE TRIGGER update_calendar_synced_at_trigger
  BEFORE UPDATE OF calendar_event_id ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_calendar_synced_at();

-- Create function to initialize calendar settings
CREATE OR REPLACE FUNCTION initialize_calendar_settings()
RETURNS trigger AS $$
BEGIN
  INSERT INTO calendar_settings (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to initialize settings for new users
DROP TRIGGER IF EXISTS initialize_calendar_settings_trigger ON auth.users;
CREATE TRIGGER initialize_calendar_settings_trigger
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION initialize_calendar_settings();

-- Initialize settings for existing users
INSERT INTO calendar_settings (user_id)
SELECT id FROM auth.users
ON CONFLICT (user_id) DO NOTHING;