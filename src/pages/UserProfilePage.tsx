import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Loader2, ArrowLeft, User, Mail, Calendar, Shield, CheckCircle2, XCircle, X, Key, Copy, Check } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { cn } from '../lib/utils';
import { userService } from '../services/userService';

interface UserProfile {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  created_at: string;
  role: 'admin' | 'user';
  is_admin: boolean;
}

function UserProfilePage() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState<{ id: string } | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [apiToken, setApiToken] = useState<string | null>(null);
  const [showToken, setShowToken] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [isGeneratingToken, setIsGeneratingToken] = useState(false);

  const [stats, setStats] = useState({
    created: 0,
    responsible: 0,
    coworker: 0,
    completed: 0
  });
  const [responsibleTasks, setResponsibleTasks] = useState<any[]>([]);
  const [coworkerTasks, setCoworkerTasks] = useState<any[]>([]);
  const [showResponsibleTasks, setShowResponsibleTasks] = useState(false);
  const [showCoworkerTasks, setShowCoworkerTasks] = useState(false);

  useEffect(() => {
    async function init() {
      try {
        setIsLoading(true);
        setError(null);

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setError('Authentication required');
          return;
        }
        setCurrentUser(user);
        
        // If no userId provided, use current user's ID
        const targetUserId = userId || user.id;
        
        // Only allow viewing other users' profiles if current user is admin
        if (targetUserId !== user.id) {
          const { data: roles } = await supabase
            .from('user_roles')
            .select('is_admin')
            .eq('user_id', user.id)
            .single();
            
          if (!roles?.is_admin) {
            navigate('/profile');
            return;
          }
        }
        
        await Promise.all([
          fetchUserProfile(targetUserId),
          fetchUserStats(targetUserId),
          fetchUserTasks(targetUserId)
        ]);
      } catch (err) {
        console.error('Failed to initialize:', err);
        setError('Failed to load profile');
      } finally {
        setIsLoading(false);
      }
    }
    
    init();
  }, [userId, navigate]);

  async function fetchUserTasks(targetUserId: string) {
    try {
      // Get all tasks for this user
      const { data: tasks } = await supabase
        .from('tasks')
        .select(`
          *,
          status:task_statuses(*)
        `);

      if (!tasks) return;

      // Filter tasks where user is responsible or coworker
      const responsible = tasks.filter(t => t.responsible_id === targetUserId);
      const coworker = tasks.filter(t => t.coworkers?.includes(targetUserId));
      const createdTasks = tasks.filter(t => t.owner_id === targetUserId);
      const completed = tasks.filter(t => t.result !== null);

      setResponsibleTasks(responsible);
      setCoworkerTasks(coworker);
      setStats(prev => ({
        created: createdTasks.length,
        responsible: responsible.length,
        coworker: coworker.length,
        completed: completed.length
      }));

    } catch (err) {
      console.error('Failed to fetch user tasks:', err);
    }
  }

  async function fetchUserProfile(targetUserId: string) {
    try {
      setIsLoading(true);
      setError(null);

      // Get user profile
      const { data: profiles, error: profileError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', targetUserId)
        .single();

      if (profileError) throw profileError;

      // Get user role
      const { data: roles } = await supabase
        .from('user_roles')
        .select('*')
        .eq('user_id', targetUserId)
        .maybeSingle();

      setUser({
        id: profiles.user_id,
        email: profiles.email,
        first_name: profiles.first_name,
        last_name: profiles.last_name,
        created_at: profiles.created_at,
        role: roles?.role || 'user',
        is_admin: roles?.is_admin || false
      });

    } catch (err) {
      console.error('Failed to fetch user profile:', err);
      setError('Failed to load user profile');
    } finally {
      setIsLoading(false);
    }
  }

  async function fetchUserStats(targetUserId: string) {
    try {
      // Get all tasks
      const { data: tasks } = await supabase
        .from('tasks')
        .select('*, status:task_statuses(*)');

      if (!tasks) return;

      // Filter tasks for responsible and coworker
      const responsible = tasks.filter(t => t.responsible_id === targetUserId);
      const coworker = tasks.filter(t => t.coworkers?.includes(targetUserId));

      // Get completed tasks
      const { data: doneStatus } = await supabase
        .from('task_statuses')
        .select('id')
        .eq('name', 'Done')
        .single();

      const completedTasks = tasks.filter(task => 
        task.status_id === doneStatus?.id
      );

      setStats({
        tasksCreated: tasks.filter(t => t.owner_id === targetUserId).length,
        tasksAssigned: tasks.length,
        tasksCompleted: tasks.filter(t => t.status_id === doneStatus?.id).length,
        tasksResponsible: responsible.length,
        tasksCoworker: coworker.length
      });

      setResponsibleTasks(responsible);
      setCoworkerTasks(coworker);

    } catch (err) {
      console.error('Failed to fetch user stats:', err);
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <button
          onClick={() => navigate(-1)}
          className="mb-6 inline-flex items-center px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 bg-white rounded-lg shadow-sm hover:shadow transition-all"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back
        </button>
        <div className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full">
          <div className="flex items-center justify-center w-12 h-12 mx-auto mb-4 rounded-full bg-red-100">
            <XCircle className="w-6 h-6 text-red-600" />
          </div>
          <h3 className="text-lg font-medium text-center text-gray-900 mb-2">
            Error Loading Profile
          </h3>
          <p className="text-sm text-center text-gray-600 mb-6">
            {error || 'User not found'}
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
    <div className="min-h-screen bg-gray-50 pt-4">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* API Token Section */}
        <div className="bg-white rounded-lg shadow-lg overflow-hidden mb-6">
          <div className="p-6 border-b">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center">
                  <Key className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <h2 className="text-lg font-medium text-gray-900">API Access</h2>
                  <p className="text-sm text-gray-500">Manage your API tokens for external access</p>
                </div>
              </div>
              <button
                onClick={async () => {
                  try {
                    setIsGeneratingToken(true);
                    const { data: { session } } = await supabase.auth.getSession();
                    if (session?.access_token) {
                      setApiToken(session.access_token);
                      setShowToken(true);
                    }
                  } catch (err) {
                    console.error('Failed to generate token:', err);
                  } finally {
                    setIsGeneratingToken(false);
                  }
                }}
                disabled={isGeneratingToken}
                className={cn(
                  "px-4 py-2 text-sm font-medium rounded-lg transition-colors",
                  "bg-indigo-600 text-white hover:bg-indigo-700",
                  "disabled:opacity-50 disabled:cursor-not-allowed",
                  "flex items-center gap-2"
                )}
              >
                {isGeneratingToken ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Key className="w-4 h-4" />
                    Generate Token
                  </>
                )}
              </button>
            </div>
            {apiToken && showToken && (
              <div className="mt-4">
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-gray-50 p-4 rounded-lg font-mono text-sm break-all">
                    {apiToken}
                  </div>
                  <button
                    onClick={async () => {
                      await navigator.clipboard.writeText(apiToken);
                      setIsCopied(true);
                      setTimeout(() => setIsCopied(false), 2000);
                    }}
                    className={cn(
                      "p-2 rounded-lg transition-colors",
                      isCopied
                        ? "bg-emerald-100 text-emerald-600"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    )}
                  >
                    {isCopied ? (
                      <Check className="w-5 h-5" />
                    ) : (
                      <Copy className="w-5 h-5" />
                    )}
                  </button>
                </div>
                <p className="mt-2 text-sm text-gray-500">
                  This token can be used to authenticate API requests. Keep it secure and never share it publicly.
                </p>
              </div>
            )}
            <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
              <code>
                {`curl -X GET 'https://ljkabmsuwjgigawvskuh.supabase.co/rest/v1/tasks' \\
  -H "apikey: ${import.meta.env.VITE_SUPABASE_ANON_KEY}" \\
  -H "Authorization: Bearer YOUR_API_TOKEN" \\
  -H "Content-Type: application/json"`}
              </code>
            </pre>
          </div>
        </div>

        <button
          onClick={() => navigate(-1)}
          className={cn(
            "mb-6 inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-lg transition-all",
            "text-gray-600 hover:text-gray-900 bg-white/50 hover:bg-white",
            "shadow-sm hover:shadow border border-gray-200/50"
          )}
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back
        </button>

        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          {/* Header */}
          <div className="p-6 sm:p-8 border-b relative">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className={cn(
                  "w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold",
                  user.is_admin ? "bg-indigo-100 text-indigo-700" : "bg-gray-100 text-gray-700"
                )}>
                  {userService.formatUserName(user).charAt(0).toUpperCase()}
                </div>
              </div>
              <div className="ml-6">
                <h1 className="text-2xl font-bold text-gray-900">
                  {userService.formatUserName(user)}
                </h1>
                <div className="mt-2 flex items-center space-x-4">
                  <div className="flex items-center text-gray-500">
                    <Mail className="w-4 h-4 mr-1.5" />
                    <span className="text-sm">{user.email}</span>
                  </div>
                  <div className="flex items-center text-gray-500">
                    <Calendar className="w-4 h-4 mr-1.5" />
                    <span className="text-sm">
                      Joined {new Date(user.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>
              {user.is_admin && (
                <div className="absolute top-6 right-6">
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-indigo-100 text-indigo-800">
                    <Shield className="w-4 h-4 mr-1.5" />
                    Admin
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-px bg-gray-200">
            <div className="bg-white p-6">
              <div className="text-sm font-medium text-gray-500 mb-1">Tasks Created</div>
              <button
                onClick={() => navigate(`/tasks/created`)}
                className="text-3xl font-bold text-gray-900 hover:text-indigo-600 transition-colors"
              >
                {stats.created}
              </button>
            </div>
            <div className="bg-white p-6">
              <div className="text-sm font-medium text-gray-500 mb-1">Responsible For</div>
              <button
                onClick={() => setShowResponsibleTasks(!showResponsibleTasks)}
                className="text-3xl font-bold text-gray-900 hover:text-indigo-600 transition-colors"
              >
                {stats.responsible}
              </button>
            </div>
            <div className="bg-white p-6">
              <div className="text-sm font-medium text-gray-500 mb-1">Co-worker On</div>
              <button
                onClick={() => setShowCoworkerTasks(!showCoworkerTasks)}
                className="text-3xl font-bold text-gray-900 hover:text-indigo-600 transition-colors"
              >
                {stats.coworker}
              </button>
            </div>
          </div>

          {/* Tasks Lists */}
          <div className="p-6 sm:p-8">
            {/* Responsible Tasks */}
            {showResponsibleTasks && (
              <div className="mb-8 animate-in slide-in-from-top duration-300">
                <h2 className="text-lg font-medium text-gray-900 mb-4 flex items-center justify-between">
                  <span>Responsible For</span>
                  <button
                    onClick={() => setShowResponsibleTasks(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </h2>
                <div className="space-y-4">
                  {responsibleTasks.length > 0 ? (
                    responsibleTasks.map(task => (
                      <div
                        key={task.id}
                        onClick={() => navigate(`/tasks/${task.id}`)}
                        className="bg-white rounded-lg border shadow-sm hover:shadow-md transition-shadow cursor-pointer p-4"
                      >
                        <div className="flex items-center justify-between">
                          <h3 className="text-base font-medium text-gray-900">{task.title}</h3>
                          <div
                            className="px-3 py-1 rounded-full text-sm font-medium"
                            style={{
                              backgroundColor: task.status.color,
                              color: 'white',
                              textShadow: '0 1px 2px rgba(0,0,0,0.1)'
                            }}
                          >
                            {task.status.name}
                          </div>
                        </div>
                        {task.due_date && (
                          <div className="mt-2 text-sm text-gray-500">
                            <Calendar className="w-4 h-4 inline-block mr-1" />
                            Due {new Date(task.due_date).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-gray-500 text-center py-4">
                      Not responsible for any tasks
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Co-worker Tasks */}
            {showCoworkerTasks && (
              <div className="animate-in slide-in-from-top duration-300">
                <h2 className="text-lg font-medium text-gray-900 mb-4 flex items-center justify-between">
                  <span>Co-worker On</span>
                  <button
                    onClick={() => setShowCoworkerTasks(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </h2>
                <div className="space-y-4">
                  {coworkerTasks.length > 0 ? (
                    coworkerTasks.map(task => (
                      <div
                        key={task.id}
                        onClick={() => navigate(`/tasks/${task.id}`)}
                        className="bg-white rounded-lg border shadow-sm hover:shadow-md transition-shadow cursor-pointer p-4"
                      >
                        <div className="flex items-center justify-between">
                          <h3 className="text-base font-medium text-gray-900">{task.title}</h3>
                          <div
                            className="px-3 py-1 rounded-full text-sm font-medium"
                            style={{
                              backgroundColor: task.status.color,
                              color: 'white',
                              textShadow: '0 1px 2px rgba(0,0,0,0.1)'
                            }}
                          >
                            {task.status.name}
                          </div>
                        </div>
                        {task.due_date && (
                          <div className="mt-2 text-sm text-gray-500">
                            <Calendar className="w-4 h-4 inline-block mr-1" />
                            Due {new Date(task.due_date).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-gray-500 text-center py-4">
                      Not a co-worker on any tasks
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Activity Feed - Coming Soon */}
            <div className="mt-8 pt-8 border-t">
              <h2 className="text-lg font-medium text-gray-900 mb-4">Recent Activity</h2>
              <p className="text-sm text-gray-500 text-center py-4">
                Activity feed coming soon...
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default UserProfilePage;