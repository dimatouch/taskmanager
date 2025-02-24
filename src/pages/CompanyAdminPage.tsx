import { useState, useEffect } from 'react';
import { 
  Building2,
  Users,
  Settings,
  Mail,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  AlertTriangle,
  Globe,
  Plus,
  ChevronRight,
  Shield,
  UserPlus
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { cn } from '../lib/utils';
import { CompanyRegistrationSettings } from '../components/companies/CompanyRegistrationSettings';
import { CompanyMembersList } from '../components/companies/CompanyMembersList';
import { CompanyRegistrationRequests } from '../components/companies/CompanyRegistrationRequests';

export function CompanyAdminPage() {
  const [activeTab, setActiveTab] = useState<'settings' | 'members' | 'requests'>('settings');
  const [company, setCompany] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState({
    totalMembers: 0, 
    pendingRequests: 0,
  });

  useEffect(() => {
    fetchCompanyData();
  }, []);

  const fetchCompanyData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Get current user's profile
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No authenticated user');

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('current_company_id')
        .eq('user_id', user.id)
        .single();

      if (!profile?.current_company_id) {
        throw new Error('No company selected');
      }

      // Get company data
      const { data: company, error: companyError } = await supabase
        .from('companies')
        .select('*')
        .eq('id', profile.current_company_id)
        .single();

      if (companyError) throw companyError;
      setCompany(company);

      // Get stats
      const [membersData, requestsData] = await Promise.all([
        supabase
          .from('company_member_profiles')
          .select('*')
          .eq('company_id', company.id),
        supabase
          .from('company_registration_requests')
          .select('count')
          .eq('company_id', company.id)
          .eq('status', 'pending'),
      ]);

      setStats({
        totalMembers: membersData.data?.length || 0,
        pendingRequests: requestsData.count || 0,
      });

    } catch (err) {
      console.error('Failed to fetch company data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load company data');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (error || !company) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <div className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full">
          <div className="flex items-center justify-center w-12 h-12 mx-auto mb-4 rounded-full bg-red-100">
            <AlertTriangle className="w-6 h-6 text-red-600" />
          </div>
          <h3 className="text-lg font-medium text-center text-gray-900 mb-2">
            Error Loading Company
          </h3>
          <p className="text-sm text-center text-gray-600 mb-6">
            {error || 'Company not found'}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="w-full px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-lg border overflow-hidden mb-8">
        <div className="p-6 sm:px-8">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0">
              {company.logo_url ? (
                <img
                  src={company.logo_url}
                  alt={company.name}
                  className="w-10 h-10 rounded"
                />
              ) : (
                <Building2 className="w-8 h-8 text-indigo-600" />
              )}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-1">
                {company.name}
              </h1>
              <div className="flex items-center gap-4 text-sm text-gray-500">
                <div className="flex items-center">
                  <Globe className="w-4 h-4 mr-1" />
                  {company.slug}
                </div>
                <div className="flex items-center">
                  <Users className="w-4 h-4 mr-1" />
                  {stats.totalMembers} members
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 divide-x border-t bg-gray-50">
          <div className="p-4 text-center">
            <div className="text-2xl font-bold text-indigo-600">
              {stats.totalMembers}
            </div>
            <div className="text-sm text-gray-500">Total Members</div>
          </div>
          <div className="p-4 text-center">
            <div className="text-2xl font-bold text-amber-600">
              {stats.pendingRequests}
            </div>
            <div className="text-sm text-gray-500">Pending Requests</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-t px-6">
          <div className="flex space-x-8">
            <button
              onClick={() => setActiveTab('settings')}
              className={cn(
                "py-4 text-sm font-medium border-b-2 -mb-px transition-colors",
                activeTab === 'settings'
                  ? "border-indigo-500 text-indigo-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              )}
            >
              <Settings className="w-4 h-4 inline-block mr-2" />
              Settings
            </button>
            <button
              onClick={() => setActiveTab('members')}
              className={cn(
                "py-4 text-sm font-medium border-b-2 -mb-px transition-colors",
                activeTab === 'members'
                  ? "border-indigo-500 text-indigo-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              )}
            >
              <Users className="w-4 h-4 inline-block mr-2" />
              Members
            </button>
            <button
              onClick={() => setActiveTab('requests')}
              className={cn(
                "py-4 text-sm font-medium border-b-2 -mb-px transition-colors relative",
                activeTab === 'requests'
                  ? "border-indigo-500 text-indigo-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              )}
            >
              <UserPlus className="w-4 h-4 inline-block mr-2" />
              Requests
              {stats.pendingRequests > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center">
                  {stats.pendingRequests}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="space-y-6">
        {activeTab === 'settings' && (
          <CompanyRegistrationSettings 
            company={company}
            onUpdate={fetchCompanyData}
          />
        )}

        {activeTab === 'members' && (
          <CompanyMembersList
            company={company}
            onUpdate={fetchCompanyData}
          />
        )}

        {activeTab === 'requests' && (
          <CompanyRegistrationRequests
            company={company}
            onUpdate={fetchCompanyData}
          />
        )}
      </div>
    </div>
  );
}