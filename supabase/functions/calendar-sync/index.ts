import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";
import { corsHeaders } from "../_shared/cors.ts";

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_CALENDAR_URL = 'https://www.googleapis.com/calendar/v3';
const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID') || '';
const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET') || '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || '';

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { path, calendarId, eventId, event, timeMin, timeMax } = await req.json();

    // Create Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false
      }
    });

    // Get current user from auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('No authorization header');

    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (authError) throw authError;
    if (!user) throw new Error('No authenticated user');

    // Get calendar settings
    const { data: settings, error: settingsError } = await supabase
      .from('calendar_settings')
      .select('google_refresh_token')
      .eq('user_id', user.id)
      .single();

    if (settingsError) throw settingsError;
    if (!settings?.google_refresh_token) throw new Error('No refresh token found');

    // Get access token
    const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        refresh_token: settings.google_refresh_token,
        grant_type: 'refresh_token',
      }),
    });

    if (!tokenResponse.ok) {
      throw new Error('Failed to refresh access token');
    }

    const { access_token } = await tokenResponse.json();

    let response;

    switch (path) {
      case 'events': {
        // List events
        const params = new URLSearchParams({
          timeMin: timeMin || new Date().toISOString(),
          timeMax: timeMax || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          singleEvents: 'true',
          orderBy: 'startTime'
        });

        response = await fetch(
          `${GOOGLE_CALENDAR_URL}/calendars/${calendarId}/events?${params}`,
          { 
            headers: {
              'Authorization': `Bearer ${access_token}`,
              'Content-Type': 'application/json',
            }
          }
        );
        break;
      }

      case 'create-event': {
        // Create event
        response = await fetch(
          `${GOOGLE_CALENDAR_URL}/calendars/${calendarId}/events`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${access_token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(event)
          }
        );
        break;
      }

      case 'update-event': {
        // Update event
        response = await fetch(
          `${GOOGLE_CALENDAR_URL}/calendars/${calendarId}/events/${eventId}`,
          {
            method: 'PUT',
            headers: {
              'Authorization': `Bearer ${access_token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(event)
          }
        );
        break;
      }

      case 'delete-event': {
        // Delete event
        response = await fetch(
          `${GOOGLE_CALENDAR_URL}/calendars/${calendarId}/events/${eventId}`,
          {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${access_token}`,
            }
          }
        );
        break;
      }

      case 'refresh-token': {
        // Just return the access token
        return new Response(
          JSON.stringify({ data: { access_token } }),
          {
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json',
            },
          }
        );
      }

      default:
        throw new Error('Invalid path');
    }

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Calendar API error');
    }

    const data = path === 'delete-event' ? { success: true } : await response.json();

    return new Response(
      JSON.stringify({ data }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({
        error: error.message,
      }),
      {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});