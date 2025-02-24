import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";
import { corsHeaders } from "../_shared/cors.ts";

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_CALENDAR_URL = 'https://www.googleapis.com/calendar/v3/users/me/calendarList';
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
    console.log('Received request:', req.method);

    // Get request data
    const { code, redirectUri } = await req.json();
    console.log('Request data:', { code, redirectUri });

    if (!code) {
      throw new Error('No authorization code provided');
    }

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

    console.log('Authenticated user:', user.id);

    console.log('Exchanging code for tokens...');
    // Exchange code for tokens
    const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    const tokenData = await tokenResponse.json();
    console.log('Token response status:', tokenResponse.status);

    if (!tokenResponse.ok) {
      console.error('Token error:', tokenData);
      throw new Error(tokenData.error_description || 'Failed to exchange code');
    }

    if (!tokenData.refresh_token) {
      console.error('No refresh token in response:', tokenData);
      throw new Error('No refresh token received');
    }

    console.log('Fetching calendar list...');
    // Get calendar list
    const calendarResponse = await fetch(GOOGLE_CALENDAR_URL, {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
      },
    });

    if (!calendarResponse.ok) {
      console.error('Calendar error:', await calendarResponse.text());
      throw new Error('Failed to fetch calendars');
    }

    const calendarData = await calendarResponse.json();
    console.log('Calendar response status:', calendarResponse.status);

    // Store refresh token in Supabase
    console.log('Storing refresh token for user:', user.id);
    const { error: updateError } = await supabase
      .from('calendar_settings')
      .upsert({
        user_id: user.id,
        google_refresh_token: tokenData.refresh_token,
        sync_status: 'connected',
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id'
      });

    if (updateError) {
      console.error('Failed to store refresh token:', updateError);
      throw updateError;
    }

    console.log('Successfully stored refresh token');

    return new Response(
      JSON.stringify({
        calendarData,
        message: 'Calendars fetched successfully',
      }),
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