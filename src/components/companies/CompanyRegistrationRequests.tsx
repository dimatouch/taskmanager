import { useState, useEffect } from 'react';
import { 
  UserPlus,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  User,
  Clock
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { cn } from '../../lib/utils';

interface CompanyRegistrationRequestsProps {
  company: {
    id: string;
    name: string;
  };
  onUpdate?: () => void;
}

interface RegistrationRequest {
  id: string;
  user_id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  status: 'pending' | 'approved' | 'rejected';
  requested_at: string;
  processed_at: string | null;
  notes: string | null;
}

export function CompanyRegistrationRequests({ company, onUpdate }: CompanyRegistrationRequestsProps) {
  const [requests, setRequests] = useState<RegistrationRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<string | null>(null);
  const [rejectionNotes, setRejectionNotes] = useState('');
  const [showRejectionModal, setShowRejectionModal] = useState<string | null>(null);

  useEffect(() => {
    fetchRequests();
  }, [company.id]);

  const fetchRequests = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from('company_registration_request_profiles')
        .select('*')
        .eq('company_id', company.id)
        .order('requested_at', { ascending: false });

      if (error) throw error;
      
      setRequests(data || []);
    } catch (err) {
      console.error('Failed to fetch requests:', err);
      setError(err instanceof Error ? err.message : 'Failed to load requests');
    } finally {
      setIsLoading(false);
    }
  };

  const handleApprove = async (requestId: string) => {
    try {
      setIsProcessing(requestId);
      setError(null);

      const { error } = await supabase.rpc(
        'approve_registration_request',
        { request_id: requestId }
      );

      if (error) throw error;
      fetchRequests();
      onUpdate?.();
    } catch (err) {
      console.error('Failed to approve request:', err);
      setError(err instanceof Error ? err.message : 'Failed to approve request');
    } finally {
      setIsProcessing(null);
    }
  };

  const handleReject = async (requestId: string) => {
    try {
      setIsProcessing(requestId);
      setError(null);

      const { error } = await supabase.rpc(
        'reject_registration_request',
        { 
          request_id: requestId,
          rejection_notes: rejectionNotes || null
        }
      );

      if (error) throw error;
      setShowRejectionModal(null);
      setRejectionNotes('');
      fetchRequests();
      onUpdate?.();
    } catch (err) {
      console.error('Failed to reject request:', err);
      setError(err instanceof Error ? err.message : 'Failed to reject request');
    } finally {
      setIsProcessing(null);
    }
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

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-lg border overflow-hidden">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center">
              <UserPlus className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-lg font-medium text-gray-900">Registration Requests</h2>
              <p className="text-sm text-gray-500">Manage pending registration requests</p>
            </div>
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 p-4 mb-6">
              <div className="flex">
                <AlertCircle className="h-5 w-5 text-red-400" />
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">Error</h3>
                  <div className="mt-2 text-sm text-red-700">
                    <p>{error}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {requests.length === 0 ? (
            <div className="text-center py-12">
              <UserPlus className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-sm font-medium text-gray-900">No registration requests</h3>
              <p className="mt-1 text-sm text-gray-500">
                When users request to join your company, they'll appear here
              </p>
            </div>
          ) : (
            <div className="overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      User
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Requested
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {requests.map((request) => (
                    <tr key={request.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center">
                            <User className="w-4 h-4 text-indigo-600" />
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">
                              {request.first_name && request.last_name
                                ? `${request.first_name} ${request.last_name}`
                                : request.email}
                            </div>
                            <div className="text-sm text-gray-500">
                              {request.email}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={cn(
                          "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
                          request.status === 'pending'
                            ? "bg-yellow-100 text-yellow-800"
                            : request.status === 'approved'
                            ? "bg-green-100 text-green-800"
                            : "bg-red-100 text-red-800"
                        )}>
                          {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div className="flex items-center">
                          <Clock className="w-4 h-4 mr-1" />
                          {new Date(request.requested_at).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        {request.status === 'pending' && (
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleApprove(request.id)}
                              disabled={isProcessing === request.id}
                              className={cn(
                                "inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-medium",
                                "bg-emerald-100 text-emerald-700",
                                "hover:bg-emerald-200",
                                "disabled:opacity-50 disabled:cursor-not-allowed"
                              )}
                            >
                              {isProcessing === request.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <CheckCircle2 className="w-4 h-4 mr-1" />
                              )}
                              Approve
                            </button>
                            <button
                              onClick={() => setShowRejectionModal(request.id)}
                              disabled={isProcessing === request.id}
                              className={cn(
                                "inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-medium",
                                "bg-red-100 text-red-700",
                                "hover:bg-red-200",
                                "disabled:opacity-50 disabled:cursor-not-allowed"
                              )}
                            >
                              <XCircle className="w-4 h-4 mr-1" />
                              Reject
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Rejection Modal */}
      {showRejectionModal && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-[2px] flex items-center justify-center p-4 z-[60]">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Reject Registration Request
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Rejection Notes (Optional)
                </label>
                <textarea
                  value={rejectionNotes}
                  onChange={(e) => setRejectionNotes(e.target.value)}
                  className={cn(
                    "w-full px-4 py-2 text-sm rounded-lg transition-all",
                    "border border-gray-200 focus:border-red-500",
                    "focus:ring-2 focus:ring-red-500/10",
                    "placeholder:text-gray-400",
                    "resize-none h-32"
                  )}
                  placeholder="Explain why the request was rejected..."
                />
              </div>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => {
                    setShowRejectionModal(null);
                    setRejectionNotes('');
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleReject(showRejectionModal)}
                  disabled={isProcessing === showRejectionModal}
                  className={cn(
                    "px-4 py-2 text-sm font-medium rounded-lg",
                    "bg-red-600 text-white",
                    "hover:bg-red-700",
                    "disabled:opacity-50 disabled:cursor-not-allowed",
                    "flex items-center gap-2"
                  )}
                >
                  {isProcessing === showRejectionModal ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Rejecting...
                    </>
                  ) : (
                    <>
                      <XCircle className="w-4 h-4" />
                      Reject Request
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}