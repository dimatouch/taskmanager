import { useState, useEffect } from 'react';
import { 
  Settings,
  Mail,
  Globe,
  Plus,
  X,
  Loader2,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { cn } from '../../lib/utils';

interface CompanyRegistrationSettingsProps {
  company: {
    id: string;
    name: string;
  };
  onUpdate?: () => void;
}

export function CompanyRegistrationSettings({ company, onUpdate }: CompanyRegistrationSettingsProps) {
  const [settings, setSettings] = useState<{
    allow_public_registration: boolean;
    require_approval: boolean;
    allowed_email_domains: string[] | null;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [newDomain, setNewDomain] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, [company.id]);

  const fetchSettings = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from('company_registration_settings')
        .select('*')
        .eq('company_id', company.id)
        .single();

      if (error) throw error;
      setSettings(data);
    } catch (err) {
      console.error('Failed to fetch settings:', err);
      setError(err instanceof Error ? err.message : 'Failed to load settings');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    if (!settings) return;

    try {
      setIsSaving(true);
      setError(null);

      const { error } = await supabase
        .from('company_registration_settings')
        .upsert({
          company_id: company.id,
          ...settings,
          updated_at: new Date().toISOString()
        });

      if (error) throw error;

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
      onUpdate?.();
    } catch (err) {
      console.error('Failed to save settings:', err);
      setError(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddDomain = () => {
    if (!newDomain || !settings) return;

    const domain = newDomain.toLowerCase().trim();
    if (settings.allowed_email_domains?.includes(domain)) return;

    setSettings(prev => prev ? {
      ...prev,
      allowed_email_domains: [
        ...(prev.allowed_email_domains || []),
        domain
      ]
    } : null);
    setNewDomain('');
  };

  const handleRemoveDomain = (domain: string) => {
    setSettings(prev => prev ? {
      ...prev,
      allowed_email_domains: prev.allowed_email_domains?.filter(d => d !== domain) || null
    } : null);
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-lg border p-6">
        <div className="flex items-center justify-center h-32">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
        </div>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="bg-white rounded-lg shadow-lg border p-6">
        <div className="flex items-center justify-center h-32">
          <div className="text-center">
            <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-2" />
            <p className="text-gray-500">Failed to load settings</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Registration Settings */}
      <div className="bg-white rounded-lg shadow-lg border overflow-hidden">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center">
              <Settings className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-lg font-medium text-gray-900">Registration Settings</h2>
              <p className="text-sm text-gray-500">Configure how users can join your company</p>
            </div>
          </div>

          <div className="space-y-6">
            {/* Public Registration */}
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium text-gray-900">Public Registration</h3>
                <p className="text-sm text-gray-500">Allow users to request to join your company</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.allow_public_registration}
                  onChange={(e) => setSettings(prev => prev ? {
                    ...prev,
                    allow_public_registration: e.target.checked
                  } : null)}
                  className="sr-only peer"
                />
                <div className={cn(
                  "w-11 h-6 rounded-full peer",
                  "after:content-[''] after:absolute after:top-[2px] after:left-[2px]",
                  "after:bg-white after:rounded-full after:h-5 after:w-5",
                  "after:transition-all peer-checked:after:translate-x-full",
                  "bg-gray-200 peer-checked:bg-indigo-600"
                )} />
              </label>
            </div>

            {/* Require Approval */}
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium text-gray-900">Require Approval</h3>
                <p className="text-sm text-gray-500">Manually approve new member requests</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.require_approval}
                  onChange={(e) => setSettings(prev => prev ? {
                    ...prev,
                    require_approval: e.target.checked
                  } : null)}
                  className="sr-only peer"
                />
                <div className={cn(
                  "w-11 h-6 rounded-full peer",
                  "after:content-[''] after:absolute after:top-[2px] after:left-[2px]",
                  "after:bg-white after:rounded-full after:h-5 after:w-5",
                  "after:transition-all peer-checked:after:translate-x-full",
                  "bg-gray-200 peer-checked:bg-indigo-600"
                )} />
              </label>
            </div>

            {/* Allowed Email Domains */}
            <div>
              <h3 className="text-sm font-medium text-gray-900 mb-2">Allowed Email Domains</h3>
              <p className="text-sm text-gray-500 mb-4">
                Restrict registration to specific email domains
              </p>

              <div className="space-y-3">
                {/* Domain List */}
                <div className="flex flex-wrap gap-2">
                  {settings.allowed_email_domains?.map(domain => (
                    <div
                      key={domain}
                      className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm"
                    >
                      <Globe className="w-3.5 h-3.5 text-gray-400" />
                      {domain}
                      <button
                        onClick={() => handleRemoveDomain(domain)}
                        className="p-0.5 hover:bg-gray-200 rounded-full text-gray-400 hover:text-gray-600"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Add Domain Input */}
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      value={newDomain}
                      onChange={(e) => setNewDomain(e.target.value)}
                      placeholder="example.com"
                      className={cn(
                        "w-full px-4 py-2 text-sm rounded-lg transition-all",
                        "border border-gray-200 focus:border-indigo-500",
                        "focus:ring-2 focus:ring-indigo-500/10",
                        "placeholder:text-gray-400"
                      )}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddDomain();
                        }
                      }}
                    />
                    <Mail className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  </div>
                  <button
                    onClick={handleAddDomain}
                    disabled={!newDomain}
                    className={cn(
                      "px-4 py-2 text-sm font-medium rounded-lg",
                      "bg-indigo-600 text-white",
                      "hover:bg-indigo-700",
                      "disabled:opacity-50 disabled:cursor-not-allowed",
                      "flex items-center gap-2"
                    )}
                  >
                    <Plus className="w-4 h-4" />
                    Add
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t flex items-center justify-between">
          {error && (
            <div className="flex items-center text-red-600 text-sm">
              <AlertCircle className="w-4 h-4 mr-1" />
              {error}
            </div>
          )}
          {saveSuccess && (
            <div className="flex items-center text-emerald-600 text-sm">
              <CheckCircle2 className="w-4 h-4 mr-1" />
              Settings saved successfully
            </div>
          )}
          <div className="flex items-center gap-3 ml-auto">
            <button
              onClick={handleSaveSettings}
              disabled={isSaving}
              className={cn(
                "px-4 py-2 text-sm font-medium rounded-lg",
                "bg-indigo-600 text-white",
                "hover:bg-indigo-700",
                "disabled:opacity-50 disabled:cursor-not-allowed",
                "flex items-center gap-2"
              )}
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}