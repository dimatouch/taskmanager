import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

export function GoogleCalendarCallback() {
  const navigate = useNavigate();
  const [debugInfo, setDebugInfo] = useState<any>({});

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const state = urlParams.get('state');
    
    setDebugInfo({
      code: code,
      state: state,
      currentUrl: window.location.href
    });
    
    if (code && state) {
      try {
        const decodedState = JSON.parse(atob(state));
        setDebugInfo(prev => ({
          ...prev,
          decodedState
        }));
        
        const { companyId } = decodedState;
        
        // Navigate to calendar page with code
        navigate(`/${companyId}/calendar?code=${code}`);
      } catch (err) {
        setDebugInfo(prev => ({
          ...prev,
          error: err.message
        }));
        navigate('/');
      }
    }
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-lg p-6 max-w-lg w-full">
        <div className="flex justify-center mb-4">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
        </div>
        <h2 className="text-lg font-medium text-center text-gray-900 mb-2">
          Processing Google Calendar Authorization
        </h2>
        <p className="text-sm text-center text-gray-500">
          Please wait while we complete the authorization process...
        </p>
      </div>
    </div>
  );
}