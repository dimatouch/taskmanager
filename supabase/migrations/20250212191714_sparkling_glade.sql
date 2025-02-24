-- Add calendar integration fields to tasks
ALTER TABLE tasks
ADD COLUMN calendar_event_id text,
ADD COLUMN calendar_synced_at timestamptz;

-- Create calendar_settings table
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

-- Create function to update calendar_synced_at
CREATE OR REPLACE FUNCTION update_calendar_synced_at()
RETURNS trigger AS $$
BEGIN
  NEW.calendar_synced_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for calendar sync
CREATE TRIGGER update_calendar_synced_at_trigger
  BEFORE UPDATE OF calendar_event_id ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_calendar_synced_at();