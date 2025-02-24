import { supabase } from '../lib/supabase';

const SUPABASE_FUNCTION_URL = 'https://ljkabmsuwjgigawvskuh.supabase.co/functions/v1/calendar-sync';

interface GoogleEvent {
  id?: string;
  summary: string;
  description?: string;
  start: {
    dateTime: string;
    timeZone: string;
  };
  end: {
    dateTime: string;
    timeZone: string;
  };
  reminders?: {
    useDefault: boolean;
    overrides?: {
      method: 'email' | 'popup';
      minutes: number;
    }[];
  };
}

export const calendarService = {
  async getSettings() {
    try {
      // Get current session first
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        return null;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No authenticated user');

      // Ensure settings exist
      await supabase
        .from('calendar_settings')
        .upsert({ 
          user_id: session.user.id,
          sync_status: 'disconnected' 
        }, {
          onConflict: 'user_id'
        });

      const { data, error } = await supabase
        .from('calendar_settings')
        .select('*')
        .eq('user_id', session.user.id)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error getting calendar settings:', error);
      throw error;
    }
  },

  async updateSettings(settings: Partial<{
    google_calendar_id: string | null;
    auto_sync: boolean;
    default_reminder_minutes: number;
    sync_description: boolean;
    sync_status: string;
  }>) {
    try {
      // Get current session
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        throw new Error('No authenticated session');
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No authenticated user');

      const { error } = await supabase
        .from('calendar_settings')
        .upsert({
          user_id: session.user.id,
          ...settings,
          sync_status: settings.google_calendar_id ? 'connected' : 'disconnected',
          last_sync_at: settings.google_calendar_id ? new Date().toISOString() : null,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        });

      if (error) throw error;
    } catch (error) {
      console.error('Error updating calendar settings:', error);
      throw error;
    }
  },

  async listEvents(start: Date, end: Date) {
    try {
      const settings = await this.getSettings();
      if (!settings?.google_calendar_id) {
        throw new Error('No calendar selected');
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('No authenticated session');

      const response = await fetch(SUPABASE_FUNCTION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          path: 'events',
          calendarId: settings.google_calendar_id,
          timeMin: start.toISOString(),
          timeMax: end.toISOString()
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch events');
      }

      return await response.json();
    } catch (error) {
      console.error('Error listing events:', error);
      throw error;
    }
  },

  async createEvent(event: GoogleEvent) {
    try {
      const settings = await this.getSettings();
      if (!settings) {
        throw new Error('No calendar settings found');
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('No authenticated session');

      // Get calendar ID from settings or use primary calendar
      const calendarId = settings.google_calendar_id || 'primary';

      const response = await fetch(SUPABASE_FUNCTION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          path: 'create-event',
          calendarId,
          event
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create event');
      }

      return await response.json();
    } catch (error) {
      console.error('Error creating event:', error);
      throw error;
    }
  },

  async updateEvent(eventId: string, event: GoogleEvent) {
    try {
      const settings = await this.getSettings();
      if (!settings?.google_calendar_id) {
        throw new Error('No calendar selected');
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('No authenticated session');

      const response = await fetch(SUPABASE_FUNCTION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          path: 'update-event',
          calendarId: settings.google_calendar_id,
          eventId,
          event
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update event');
      }

      return await response.json();
    } catch (error) {
      console.error('Error updating event:', error);
      throw error;
    }
  },

  async deleteEvent(eventId: string) {
    try {
      const settings = await this.getSettings();
      if (!settings?.google_calendar_id) {
        throw new Error('No calendar selected');
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('No authenticated session');

      const response = await fetch(SUPABASE_FUNCTION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          path: 'delete-event',
          calendarId: settings.google_calendar_id,
          eventId
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete event');
      }

      return await response.json();
    } catch (error) {
      console.error('Error deleting event:', error);
      throw error;
    }
  },

  async refreshToken() {
    try {
      const settings = await this.getSettings();
      if (!settings?.google_refresh_token) {
        throw new Error('No refresh token available');
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('No authenticated session');

      const response = await fetch(SUPABASE_FUNCTION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          path: 'refresh-token',
          refreshToken: settings.google_refresh_token
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to refresh token');
      }

      const { data } = await response.json();
      return data.access_token;
    } catch (error) {
      console.error('Error refreshing token:', error);
      throw error;
    }
  }
};