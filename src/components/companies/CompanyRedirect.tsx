import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';

export function CompanyRedirect() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    async function redirectToCompany() {
      try {
        // Якщо це callback від Google OAuth, не робимо редірект
        const urlParams = new URLSearchParams(location.search);
        if (urlParams.has('code')) {
          return;
        }

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // First try to get user's current company
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('current_company_id')
          .eq('user_id', user.id)
          .single();

        if (profile?.current_company_id) {
          navigate(`/${profile.current_company_id}`);
          return;
        }

        // If no current company, get first available company
        const { data: companies } = await supabase
          .from('company_members')
          .select('company_id')
          .eq('user_id', user.id)
          .limit(1)
          .single();

        if (companies?.company_id) {
          navigate(`/${companies.company_id}`);
        }
      } catch (err) {
        console.error('Failed to redirect:', err);
      }
    }

    redirectToCompany();
  }, [navigate, location.search]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
    </div>
  );
}