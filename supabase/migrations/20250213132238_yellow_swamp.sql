/*
  # Remove Google Calendar integration

  1. Changes
    - Drop calendar-related triggers first
    - Drop calendar_settings table
    - Remove calendar-related columns from tasks
    - Drop related functions

  2. Details
    - Removes all calendar integration functionality
    - Cleans up any related database objects
    - Handles dependencies in correct order
*/

-- First drop triggers that depend on the columns
DROP TRIGGER IF EXISTS update_calendar_synced_at_trigger ON tasks;
DROP TRIGGER IF EXISTS initialize_calendar_settings_trigger ON auth.users;

-- Drop functions
DROP FUNCTION IF EXISTS update_calendar_synced_at();
DROP FUNCTION IF EXISTS initialize_calendar_settings();

-- Drop calendar settings table and all its dependencies
DROP TABLE IF EXISTS calendar_settings CASCADE;

-- Now safe to drop columns from tasks
ALTER TABLE tasks 
DROP COLUMN IF EXISTS calendar_event_id,
DROP COLUMN IF EXISTS calendar_synced_at;