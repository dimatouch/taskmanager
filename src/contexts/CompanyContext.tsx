import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';

interface Company {
  id: string;
  name: string;
  slug: string;
}

interface CompanyContextType {
  currentCompany: Company | null;
  setCurrentCompany: (company: Company | null) => void;
  companies: Company[];
  isLoading: boolean;
  error: string | null;
}

const CompanyContext = createContext<CompanyContextType>({
  currentCompany: null,
  setCurrentCompany: () => {},
  companies: [],
  isLoading: true,
  error: null
});

export function CompanyProvider({ children }: { children: ReactNode }) {
  const [currentCompany, setCurrentCompany] = useState<Company | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { companyId } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    async function loadCompanies() {
      try {
        setIsLoading(true);
        setError(null);

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setError('No authenticated user');
          return;
        }

        // Get user's companies
        const { data: userCompanies, error: companiesError } = await supabase
          .from('company_members')
          .select(`
            company:companies (
              id,
              name,
              slug
            )
          `)
          .eq('user_id', user.id);

        if (companiesError) throw companiesError;

        const companies = userCompanies
          .map(uc => uc.company)
          .filter((c): c is Company => c !== null);

        setCompanies(companies);

        // If companyId is provided, set it as current
        if (companyId) {
          const company = companies.find(c => c.id === companyId);
          if (company) {
            setCurrentCompany(company);
            
            // Update user's current company
            await supabase
              .from('user_profiles')
              .update({ current_company_id: company.id })
              .eq('user_id', user.id);
          } else {
            // If company not found, redirect to first available company
            if (companies.length > 0) {
              navigate(`/${companies[0].id}`);
            }
          }
        } else {
          // If no companyId, get user's current company
          const { data: profile } = await supabase
            .from('user_profiles')
            .select('current_company_id')
            .eq('user_id', user.id)
            .single();

          if (profile?.current_company_id) {
            const company = companies.find(c => c.id === profile.current_company_id);
            if (company) {
              navigate(`/${company.id}`);
            }
          } else if (companies.length > 0) {
            // If no current company set, use first available
            navigate(`/${companies[0].id}`);
          }
        }

      } catch (err) {
        console.error('Failed to load companies:', err);
        setError(err instanceof Error ? err.message : 'Failed to load companies');
      } finally {
        setIsLoading(false);
      }
    }

    loadCompanies();
  }, [companyId]);

  return (
    <CompanyContext.Provider value={{
      currentCompany,
      setCurrentCompany,
      companies,
      isLoading,
      error
    }}>
      {children}
    </CompanyContext.Provider>
  );
}

export function useCompany() {
  return useContext(CompanyContext);
}