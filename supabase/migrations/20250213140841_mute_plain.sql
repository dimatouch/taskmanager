-- Drop triggers first
DROP TRIGGER IF EXISTS update_calendar_synced_at_trigger ON tasks CASCADE;
DROP TRIGGER IF EXISTS initialize_calendar_settings_trigger ON auth.users CASCADE;

-- Drop functions
DROP FUNCTION IF EXISTS update_calendar_synced_at() CASCADE;
DROP FUNCTION IF EXISTS initialize_calendar_settings() CASCADE;

-- Drop calendar settings table and all its dependencies
DROP TABLE IF EXISTS calendar_settings CASCADE;

-- Drop calendar-related columns from tasks
ALTER TABLE tasks 
DROP COLUMN IF EXISTS calendar_event_id CASCADE,
DROP COLUMN IF EXISTS calendar_synced_at CASCADE;