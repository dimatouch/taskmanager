import React, { useState, useEffect, useMemo } from 'react';
import { Calendar, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useTranslation } from '../../lib/i18n/useTranslation';
import { CalendarView } from './CalendarView';
import { useLocation } from 'react-router-dom';
import { useCompany } from '../../contexts/CompanyContext';
import { supabase } from '../../lib/supabase';
import { calendarService } from '../../services/calendarService';

const SUPABASE_FUNCTION_URL = 'https://ljkabmsuwjgigawvskuh.supabase.co/functions/v1/list-calendars';
const GOOGLE_CLIENT_ID = '810923765414-ho0fpb5qa6mu86ud0iohcg2n6qjr7f4q.apps.googleusercontent.com';
const REDIRECT_URI = 'https://cerulean-axolotl-0d6f4f.netlify.app/calendar-callback';

interface CalendarData {
  items: any[];
}

interface AuthState {
  initializing: boolean;
  isAuthenticating: boolean;
  loading: boolean;
  error: string | null;
}

interface CalendarSettings {
  google_refresh_token: string | null;
  google_calendar_id: string | null;
  auto_sync: boolean;
  sync_status: string;
}

export function GoogleCalendarIntegration() {
  const location = useLocation();
  const { currentCompany } = useCompany();
  const { t } = useTranslation();
  const [calendarData, setCalendarData] = useState<CalendarData | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [selectedCalendarId, setSelectedCalendarId] = useState<string | null>(null);
  const [settings, setSettings] = useState<CalendarSettings | null>(null);
  const [syncStatus, setSyncStatus] = useState<string>('');

  const [authState, setAuthState] = useState<AuthState>({
    initializing: true,
    isAuthenticating: false,
    loading: false,
    error: null
  });

  useEffect(() => {
    if (location.search && !location.search.includes('code=')) {
      const cleanUrl = window.location.pathname;
      window.history.replaceState({}, document.title, cleanUrl);
    }
  }, [location]);

  useEffect(() => {
    const checkCalendarSettings = async () => {
      try {
        // Get current user session
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          throw new Error('No authenticated session');
        }

        // Спроба створити налаштування, якщо їх немає
        await supabase
          .from('calendar_settings')
          .upsert({ 
            user_id: session.user.id,
            sync_status: 'disconnected' 
          }, {
            onConflict: 'user_id'
          });

        const settings = await calendarService.getSettings();
        setSettings(settings);

        if (settings?.google_calendar_id) {
          setSelectedCalendarId(settings.google_calendar_id);
          setIsConnected(true);
          setSyncStatus(settings.sync_status);
        }
      } catch (err) {
        console.error('Failed to check calendar settings:', err);
        setAuthState(prev => ({
          ...prev,
          error: 'Failed to load calendar settings'
        }));
      } finally {
        setAuthState(prev => ({ ...prev, initializing: false }));
      }
    };

    checkCalendarSettings();
  }, []);

  const getGoogleAuthUrl = () => {
    if (!currentCompany) {
      console.error('No current company');
      return '';
    }

    const scopes = [
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/calendar.events',
      'https://www.googleapis.com/auth/calendar.readonly'
    ];

    const state = JSON.stringify({
      companyId: currentCompany.id,
      originalPath: window.location.pathname,
      timestamp: Date.now()
    });

    const params = new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      response_type: 'code',
      scope: scopes.join(' '),
      access_type: 'offline',
      prompt: 'consent',
      state: btoa(state)
    });

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  };

  const handleConnect = () => {
    if (!currentCompany) {
      console.error('No current company');
      return;
    }
    const authUrl = getGoogleAuthUrl();
    window.location.href = authUrl;
  };

  const fetchCalendarData = async (code: string) => {
    if (!code) {
      setAuthState(prev => ({
        ...prev,
        error: t('admin.calendar.error.missingCode')
      }));
      return false;
    }

    setAuthState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No authenticated user');

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No authenticated session');

      const response = await fetch(SUPABASE_FUNCTION_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          code,
          redirectUri: REDIRECT_URI
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        console.error('Edge Function error:', data);
        throw new Error(data.error || t('admin.calendar.error.fetchFailed'));
      }

      if (!data.calendarData?.items) {
        console.error('No calendar data in response:', data);
        throw new Error(t('admin.calendar.error.fetchFailed'));
      }
      
      setCalendarData(data.calendarData);
      setIsConnected(true);

      return true;
    } catch (err: any) {
      console.error('Error fetching calendar data:', err);
      setAuthState(prev => ({
        ...prev,
        error: err.message
      }));
      return false;
    } finally {
      setAuthState(prev => ({ ...prev, loading: false }));
    }
  };

  const handleDisconnect = async () => {
    try {
      await calendarService.updateSettings({
        google_calendar_id: null,
        auto_sync: false,
        sync_status: 'disconnected'
      });

      setCalendarData(null);
      setIsConnected(false);
      setSelectedCalendarId(null);
      setSettings(null);
      setSyncStatus('disconnected');
    } catch (err) {
      console.error('Failed to disconnect calendar:', err);
      setAuthState(prev => ({
        ...prev,
        error: 'Failed to disconnect calendar'
      }));
    }
  };

  const handleSelectCalendar = async (calendarId: string) => {
    try {
      await calendarService.updateSettings({
        google_calendar_id: calendarId,
        auto_sync: true,
        sync_status: 'connected'
      });

      setSelectedCalendarId(calendarId);
      setSyncStatus('connected');
    } catch (err) {
      console.error('Failed to select calendar:', err);
      setAuthState(prev => ({
        ...prev,
        error: 'Failed to select calendar'
      }));
    }
  };

  const buttonContent = useMemo(() => {
    if (authState.isAuthenticating) {
      return (
        <>
          <Loader2 className="w-5 h-5 animate-spin" />
          Authenticating...
        </>
      );
    }
    return (
      <>
        <Calendar className="w-5 h-5" />
        {t('admin.calendar.signIn')}
      </>
    );
  }, [authState.isAuthenticating, t]);

  if (authState.initializing) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow-lg border p-6">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 rounded-lg bg-indigo-100 flex items-center justify-center">
              <Calendar className="w-6 h-6 text-indigo-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{t('admin.calendar.title')}</h1>
              <p className="text-sm text-gray-500">{t('admin.calendar.subtitle')}</p>
            </div>
          </div>
          <div className="text-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mx-auto mb-4" />
            <p className="text-sm text-gray-500">Initializing...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="bg-white rounded-lg shadow-lg border p-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 rounded-lg bg-indigo-100 flex items-center justify-center">
            <Calendar className="w-6 h-6 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{t('admin.calendar.title')}</h1>
            <p className="text-sm text-gray-500">{t('admin.calendar.subtitle')}</p>
          </div>
        </div>

        {authState.error && (
          <div className="mb-6 p-4 bg-red-50 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-medium text-red-800">Error</h3>
              <p className="mt-1 text-sm text-red-700">{authState.error}</p>
            </div>
          </div>
        )}

        {!isConnected ? (
          <div className="relative">
            <button
              onClick={handleConnect}
              disabled={authState.isAuthenticating}
              className={cn(
                "w-full px-4 py-3 text-sm font-medium rounded-lg",
                "bg-indigo-600 text-white hover:bg-indigo-700",
                "shadow-sm hover:shadow transition-all",
                "flex items-center justify-center gap-2",
                "disabled:opacity-50 disabled:cursor-not-allowed"
              )}
            >
              {buttonContent}
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center gap-3 text-sm text-emerald-600 bg-emerald-50 p-3 rounded-lg">
              <CheckCircle2 className="w-5 h-5" />
              <span className="font-medium">{t('admin.calendar.authSuccess')} ({syncStatus})</span>
            </div>

            <div>
              <h3 className="text-sm font-medium text-gray-900 mb-4">{t('admin.calendar.yourCalendars')}</h3>
              <div className="space-y-3">
                {authState.loading ? (
                  <div className="text-center py-8">
                    <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mx-auto mb-4" />
                    <p className="text-sm text-gray-500">{t('admin.calendar.loading')}</p>
                  </div>
                ) : (
                  calendarData?.items?.map((calendar: any) => (
                    <div
                      key={calendar.id}
                      className={cn(
                        "flex items-center justify-between p-4 rounded-lg border transition-all",
                        selectedCalendarId === calendar.id
                          ? "bg-indigo-50 border-indigo-200"
                          : "bg-white hover:shadow-md"
                      )}
                    >
                      <div>
                        <h4 className="text-sm font-medium text-gray-900">{calendar.summary}</h4>
                        {calendar.description && (
                          <p className="text-sm text-gray-500 mt-1">{calendar.description}</p>
                        )}
                      </div>
                      <button
                        onClick={() => handleSelectCalendar(calendar.id)}
                        className={cn(
                          "px-3 py-1.5 text-xs font-medium rounded-lg transition-colors",
                          selectedCalendarId === calendar.id
                            ? "bg-indigo-100 text-indigo-700"
                            : "bg-indigo-50 text-indigo-600 hover:bg-indigo-100"
                        )}
                      >
                        {selectedCalendarId === calendar.id ? 'Selected' : t('admin.calendar.select')}
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
            
            {selectedCalendarId && (
              <div className="mt-8 border-t pt-8">
                <CalendarView 
                  calendarId={selectedCalendarId}
                />
              </div>
            )}

            <div className="border-t pt-6">
              <button
                onClick={handleDisconnect}
                className={cn(
                  "px-4 py-2 text-sm font-medium rounded-lg",
                  "text-red-600 hover:text-red-700",
                  "bg-red-50 hover:bg-red-100",
                  "transition-colors"
                )}
              >
                Disconnect
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}