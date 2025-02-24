import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Loader2, 
  AlertCircle, 
  Calendar, 
  CheckSquare, 
  Clock, 
  AlertTriangle, 
  User,
  ChevronDown,
  ChevronUp,
  Folder,
  MessageSquare,
  ClipboardList
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { cn } from '../lib/utils';
import { userService } from '../services/userService';

interface UserStatistics {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  joined_at: string;
  role: string;
  is_admin: boolean;
  created_tasks: number;
  responsible_tasks: number;
  coworker_tasks: number;
  completed_tasks: number;
  completed_responsible_tasks: number;
  completed_coworker_tasks: number;
  overdue_tasks: number;
  total_activities: number;
  total_comments: number;
  total_progress_updates: number;
  completion_rate: number;
  created_completion_rate: number;
}

export function UserStatsPage() {
  const [users, setUsers] = useState<UserStatistics[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [userTasks, setUserTasks] = useState<Record<string, any[]>>({});
  const [isLoadingTasks, setIsLoadingTasks] = useState<Record<string, boolean>>({});
  const navigate = useNavigate();

  useEffect(() => {
    fetchUserStats();
  }, []);

  async function fetchUserStats() {
    try {
      setIsLoading(true);
      setError(null);

      // Get user statistics from materialized view
      const { data: stats, error: statsError } = await supabase
        .from('user_statistics')
        .select('*');

      if (statsError) throw statsError;
      setUsers(stats || []);

    } catch (err) {
      console.error('Failed to fetch user stats:', err);
      setError(err instanceof Error ? err.message : 'Failed to load user statistics');
    } finally {
      setIsLoading(false);
    }
  }

  async function fetchUserTasks(userId: string) {
    try {
      const { data: tasks, error } = await supabase
        .from('tasks')
        .select(`
          id,
          title,
          status_id,
          due_date,
          result,
          created_at,
          status:task_statuses(*)
        `)
        .or(`owner_id.eq.${userId},responsible_id.eq.${userId},coworkers.cs.{${userId}}`)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUserTasks(prev => ({ ...prev, [userId]: tasks }));
    } catch (err) {
      console.error('Failed to fetch user tasks:', err);
    }
  }

  const handleExpandUser = async (userId: string) => {
    if (expandedUser === userId) {
      setExpandedUser(null);
      setUserTasks(prev => {
        const newTasks = { ...prev };
        delete newTasks[userId];
        return newTasks;
      });
      return;
    }
    setExpandedUser(userId);

    if (!userTasks[userId]) {
      try {
        setIsLoadingTasks(prev => ({ ...prev, [userId]: true }));

        // Get current user session
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) {
          throw new Error('Authentication required');
        }

        const { data: tasks, error } = await supabase
          .from('tasks')
          .select(`
            id,
            title,
            description,
            status_id,
            due_date,
            result,
            created_at,
            updated_at,
            owner_id,
            responsible_id,
            coworkers,
            priority,
            project:projects(id, name),
            status:task_statuses(*)
          `)
          .or(
            `owner_id.eq.${userId},` +
            `responsible_id.eq.${userId},` +
            `coworkers.cs.{${userId}}`
          )
          .order('created_at', { ascending: false });

        if (error) throw error;
        setUserTasks(prev => ({ ...prev, [userId]: tasks || [] }));
      } catch (err) {
        console.error('Failed to fetch user tasks:', err);
        setUserTasks(prev => ({ ...prev, [userId]: [] }));
      } finally {
        setIsLoadingTasks(prev => ({ ...prev, [userId]: false }));
      }
    }
  };

  const getTaskStatusColor = (task: any) => {
    return task.status?.color || '#E5E7EB';
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const isOverdue = (task: any) => {
    if (!task.due_date || task.result) return false;
    return new Date(task.due_date) < new Date();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <div className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full">
          <div className="flex items-center justify-center w-12 h-12 mx-auto mb-4 rounded-full bg-red-100">
            <AlertCircle className="w-6 h-6 text-red-600" />
          </div>
          <h3 className="text-lg font-medium text-center text-gray-900 mb-2">
            Error Loading Statistics
          </h3>
          <p className="text-sm text-center text-gray-600 mb-6">
            {error}
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
      <h1 className="text-2xl font-bold text-gray-900 mb-8">User Statistics</h1>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {users.map((user, index) => (
          <div 
            key={user.id || `user-${index}`}
            className="bg-white rounded-lg shadow-lg border overflow-hidden hover:shadow-xl transition-shadow duration-200"
          >
            {/* User Header */}
            <div className="p-6 border-b bg-gradient-to-br from-gray-50 to-white">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center">
                  <User className="w-6 h-6 text-indigo-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-lg font-medium text-gray-900 truncate">
                    {userService.formatUserName(user)}
                  </h2>
                  <p className="text-sm text-gray-500 truncate">{user.email}</p>
                </div>
              </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-px bg-gray-200">
              <div className="bg-white p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <CheckSquare className="w-5 h-5 text-emerald-500 mr-2" />
                    <span className="text-sm text-gray-500">Completed</span>
                  </div>
                  <span className="text-lg font-semibold text-emerald-600">
                    {user.completed_tasks}
                  </span>
                </div>
              </div>

              <div className="bg-white p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <Clock className="w-5 h-5 text-blue-500 mr-2" />
                    <span className="text-sm text-gray-500">Active</span>
                  </div>
                  <span className="text-lg font-semibold text-blue-600">
                    {user.responsible_tasks + user.coworker_tasks - user.completed_tasks}
                  </span>
                </div>
              </div>

              <div className="bg-white p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <AlertTriangle className="w-5 h-5 text-amber-500 mr-2" />
                    <span className="text-sm text-gray-500">Overdue</span>
                  </div>
                  <span className="text-lg font-semibold text-amber-600">
                    {user.overdue_tasks}
                  </span>
                </div>
              </div>

              <div className="bg-white p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <Calendar className="w-5 h-5 text-indigo-500 mr-2" />
                    <span className="text-sm text-gray-500">Total</span>
                  </div>
                  <span className="text-lg font-semibold text-indigo-600">
                    {user.responsible_tasks + user.coworker_tasks}
                  </span>
                </div>
              </div>
            </div>

            {/* Role Stats */}
            <div className="p-4 bg-gray-50 border-t">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white p-3 rounded-lg border shadow-sm">
                  <div className="text-xs font-medium text-gray-500 mb-1">Tasks Created</div>
                  <div className="text-2xl font-bold text-indigo-600">{user.created_tasks}</div>
                  <div className="text-xs text-gray-400 mt-1">
                    {user.created_completion_rate}% completed
                  </div>
                </div>
                <div className="bg-white p-3 rounded-lg border shadow-sm">
                  <div className="text-xs font-medium text-gray-500 mb-1">Activities</div>
                  <div className="text-2xl font-bold text-indigo-600">{user.total_activities}</div>
                  <div className="text-xs text-gray-400 mt-1">
                    {user.total_comments} comments
                  </div>
                </div>
              </div>
            </div>

            {/* Task Details Section */}
            <div className="border-t">
              <button
                onClick={() => handleExpandUser(user.id)}
                className={cn(
                  "w-full px-4 py-3 text-sm font-medium text-left transition-colors",
                  "hover:bg-gray-50 flex items-center justify-between",
                  expandedUser === user.id ? "bg-gray-50" : "bg-white"
                )}
              >
                <span>View Tasks & Details</span>
                {expandedUser === user.id ? (
                  <ChevronUp className="w-4 h-4 text-gray-400" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                )}
              </button>

              {expandedUser === user.id && (
                <div className="p-4 bg-gray-50 space-y-4">
                  {/* Task Categories */}
                  <div className="grid grid-cols-1 gap-4">
                    {/* Responsible Tasks */}
                    {isLoadingTasks[user.id] ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
                      </div>
                    ) : (
                    userTasks[user.id]?.filter(t => t.responsible_id === user.id).length > 0 && (
                      <div key="responsible" className="bg-white rounded-lg shadow-sm border overflow-hidden">
                        <div className="px-4 py-3 bg-gradient-to-br from-emerald-50 to-white border-b">
                          <h3 className="text-sm font-medium text-emerald-900">
                            Responsible For ({user.responsible_tasks})
                          </h3>
                        </div>
                        <div className="divide-y">
                          {userTasks[user.id]
                            ?.filter(t => t.responsible_id === user.id)
                            .map(task => (
                              <div
                                key={task.id}
                                onClick={() => navigate(`/tasks/${task.id}`)}
                                className="p-3 hover:bg-gray-50 cursor-pointer"
                              >
                                <div className="flex items-center justify-between mb-1">
                                  <h4 className="text-sm font-medium text-gray-900">
                                    {task.title}
                                  </h4>
                                  {task.project && (
                                    <div className="flex items-center text-xs text-gray-500 ml-2">
                                      <Folder className="w-3.5 h-3.5 mr-1" />
                                      {task.project.name}
                                    </div>
                                  )}
                                  <div
                                    className="px-2 py-1 rounded-full text-xs font-medium"
                                    style={{
                                      backgroundColor: getTaskStatusColor(task),
                                      color: 'white',
                                      textShadow: '0 1px 2px rgba(0,0,0,0.1)'
                                    }}
                                  >
                                    {task.status?.name}
                                  </div>
                                </div>
                                <div className="flex items-center gap-3 text-xs text-gray-500">
                                  <Calendar className="w-3.5 h-3.5 mr-1" />
                                  <span className={cn(
                                    isOverdue(task) && "text-red-600 font-medium"
                                  )}>
                                    {task.due_date ? formatDate(task.due_date) : 'No due date'}
                                  </span>
                                  {task.result && (
                                    <span className="flex items-center text-emerald-600">
                                      <CheckSquare className="w-3.5 h-3.5 mr-1" />
                                      Completed
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Co-worker Tasks */}
                  {userTasks[user.id]?.filter(t => t.coworkers?.includes(user.id)).length > 0 && (
                    <div key="coworker" className="bg-white rounded-lg shadow-sm border overflow-hidden">
                      <div className="px-4 py-3 bg-gradient-to-br from-indigo-50 to-white border-b">
                        <h3 className="text-sm font-medium text-indigo-900">
                          Co-worker On ({user.coworker_tasks})
                        </h3>
                      </div>
                      <div className="divide-y">
                        {userTasks[user.id]
                          ?.filter(t => t.coworkers?.includes(user.id))
                          .map(task => (
                            <div
                              key={task.id}
                              onClick={() => navigate(`/tasks/${task.id}`)}
                              className="p-3 hover:bg-gray-50 cursor-pointer"
                            >
                              <div className="flex items-center justify-between mb-1">
                                <h4 className="text-sm font-medium text-gray-900">
                                  {task.title}
                                </h4>
                                <div
                                  className="px-2 py-1 rounded-full text-xs font-medium"
                                  style={{
                                    backgroundColor: getTaskStatusColor(task),
                                    color: 'white',
                                    textShadow: '0 1px 2px rgba(0,0,0,0.1)'
                                  }}
                                >
                                  {task.status?.name}
                                </div>
                              </div>
                              <div className="flex items-center text-xs text-gray-500">
                                <Calendar className="w-3.5 h-3.5 mr-1" />
                                <span className={cn(
                                  isOverdue(task) && "text-red-600 font-medium"
                                )}>
                                  {task.due_date ? formatDate(task.due_date) : 'No due date'}
                                </span>
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}

                  {/* Activity Stats */}
                  <div key="activity-stats" className="bg-white rounded-lg shadow-sm border overflow-hidden">
                    <div className="px-4 py-3 bg-gradient-to-br from-gray-50 to-white border-b">
                      <h3 className="text-sm font-medium text-gray-900">Activity Summary</h3>
                    </div>
                    <div className="p-4 grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center">
                            <MessageSquare className="w-4 h-4 text-blue-500 mr-1.5" />
                            <span className="text-sm text-gray-600">Comments</span>
                          </div>
                          <span className="text-sm font-medium">{user.total_comments}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center">
                            <ClipboardList className="w-4 h-4 text-emerald-500 mr-1.5" />
                            <span className="text-sm text-gray-600">Progress Updates</span>
                          </div>
                          <span className="text-sm font-medium">{user.total_progress_updates}</span>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center">
                            <Folder className="w-4 h-4 text-amber-500 mr-1.5" />
                            <span className="text-sm text-gray-600">Created</span>
                          </div>
                          <span className="text-sm font-medium">{user.created_tasks}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center">
                            <CheckSquare className="w-4 h-4 text-indigo-500 mr-1.5" />
                            <span className="text-sm text-gray-600">Completion Rate</span>
                          </div>
                          <span className="text-sm font-medium">{user.completion_rate}%</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* View Profile Button */}
              <button
                onClick={() => navigate(`/users/${user.id}`)}
                type="button"
                className={cn(
                  "w-full px-4 py-3 text-sm font-medium transition-colors",
                  "bg-indigo-50 text-indigo-600 hover:bg-indigo-100 border-t",
                  "flex items-center justify-center gap-2"
                )}
              >
                <User className="w-4 h-4" />
                View Profile & Tasks
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}