import { createClient } from '@supabase/supabase-js';
import { Database } from '../types/supabase';

// Retry configuration
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  throw new Error('Missing SUPABASE_URL');
}

if (!supabaseAnonKey) {
  throw new Error('Missing SUPABASE_ANON_KEY');
}

// Create a wrapper for fetch with retries
async function fetchWithRetry(url: string, options: any, retries = MAX_RETRIES): Promise<Response> {
  try {
    const response = await fetch(url, options);
    if (!response.ok && retries > 0) {
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
      return fetchWithRetry(url, options, retries - 1);
    }
    return response;
  } catch (error) {
    if (retries > 0) {
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
      return fetchWithRetry(url, options, retries - 1);
    }
    throw error;
  }
}

export const supabase = createClient<Database>(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      storage: localStorage
    },
    db: {
      schema: 'public'
    },
    realtime: {
      params: { eventsPerSecond: 10 }
    },
    global: {
      headers: {
        'X-Client-Info': 'supabase-js-web'
      },
      fetch: fetchWithRetry
    }
  }
);