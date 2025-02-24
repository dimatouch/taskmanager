import { useState, useEffect } from 'react';
import { Loader2, Shield, User, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { UserTasksModal } from './UserTasksModal';
import { supabase } from '../../lib/supabase';
import { cn } from '../../lib/utils';
import { userService } from '../../services/userService';

interface UserWithRole {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  role: 'admin' | 'user';
  is_admin: boolean;
  created_at: string;
}

export function UserList() {
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [userTaskCounts, setUserTaskCounts] = useState<{ [key: string]: { responsible: number; coworker: number } }>({});
  const [newUserId, setNewUserId] = useState<string | null>(null);
  const [selectedUserTasks, setSelectedUserTasks] = useState<{
    userId: string;
    type: 'responsible' | 'coworker';
    tasks: Task[];
  } | null>(null);

  // Функція для завантаження користувачів з таблиць user_profiles та user_roles
  const fetchUsers = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Запит до таблиці user_profiles (де дані зберігаються в колонках: user_id, email, first_name, last_name, created_at)
      const { data: profilesData, error: profilesError } = await supabase
        .from('user_profiles')
        .select('*');
      if (profilesError) throw profilesError;

      // Запит до таблиці user_roles (де зберігаються ролі користувачів)
      const { data: rolesData, error: rolesError } = await supabase
        .from('user_roles')
        .select('*');
      if (rolesError) throw rolesError;

      // Створюємо мапу ролей за user_id
      const rolesMap = new Map<string, { role: 'admin' | 'user'; is_admin: boolean }>();
      rolesData?.forEach((role: any) => {
        if (role.user_id) {
          rolesMap.set(role.user_id, { role: role.role, is_admin: role.is_admin });
        }
      });

      // Об'єднуємо дані з профілів і ролей. Використовуємо profile.user_id як id
      const processedUsers: UserWithRole[] = (profilesData || []).map((profile: any) => {
        const roleInfo = rolesMap.get(profile.user_id) || { role: 'user', is_admin: false };
        return {
          id: profile.user_id, // Використовуємо user_id замість id
          email: profile.email,
          first_name: profile.first_name,
          last_name: profile.last_name,
          role: roleInfo.role,
          is_admin: roleInfo.is_admin,
          created_at: profile.created_at,
        };
      });
      setUsers(processedUsers);
    } catch (err) {
      console.error('Failed to fetch users:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch users');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchTaskCounts();

    const channel = supabase
      .channel('users-channel')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_roles',
        },
        (payload) => {
          if (!payload.new || !payload.new.user_id) {
            console.warn('Received payload without valid user_id:', payload);
            return;
          }

          if (payload.eventType === 'INSERT') {
            // Додаємо нового користувача з даними з payload
            const newUser: UserWithRole = {
              id: payload.new.user_id,
              email: 'Pending...', // Placeholder, оновимо через fetchUsers()
              first_name: null,
              last_name: null,
              role: payload.new.role,
              is_admin: payload.new.is_admin,
              created_at: payload.new.created_at,
            };
            setNewUserId(newUser.id);
            setUsers((prev) => [newUser, ...prev]);
            setTimeout(() => {
              setNewUserId(null);
              fetchUsers(); // оновлюємо список, щоб отримати реальні дані з user_profiles
            }, 2000);
          } else if (payload.eventType === 'DELETE') {
            setUsers((prev) =>
              prev.filter((u) => u.id !== payload.old.user_id)
            );
          } else if (payload.eventType === 'UPDATE') {
            setUsers((prev) =>
              prev.map((u) =>
                u.id === payload.new.user_id
                  ? { ...u, role: payload.new.role, is_admin: payload.new.is_admin }
                  : u
              )
            );
          }
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, []);

  const fetchTaskCounts = async () => {
    try {
      // Get all tasks
      const { data: tasks } = await supabase
        .from('tasks')
        .select('*');

      if (!tasks) return;

      // Initialize counts
      const counts: { [key: string]: { responsible: number; coworker: number } } = {};
      
      // Count tasks for each user
      tasks.forEach(task => {
        // Count responsible tasks
        if (task.responsible_id) {
          if (!counts[task.responsible_id]) {
            counts[task.responsible_id] = { responsible: 0, coworker: 0 };
          }
          counts[task.responsible_id].responsible++;
        }

        // Count co-worker tasks
        if (task.coworkers) {
          task.coworkers.forEach(userId => {
            if (!counts[userId]) {
              counts[userId] = { responsible: 0, coworker: 0 };
            }
            counts[userId].coworker++;
          });
        }
      });

      setUserTaskCounts(counts);
    } catch (err) {
      console.error('Failed to fetch task counts:', err);
    }
  };

  const handleDeleteUser = async (userId: string | undefined) => {
    if (!userId) {
      console.error('handleDeleteUser: userId is undefined');
      return;
    }
    try {
      const { error: roleError } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId);
      if (roleError) throw roleError;

      const { error: profileError } = await supabase
        .from('user_profiles')
        .delete()
        .eq('user_id', userId);
      if (profileError) throw profileError;

      setUsers((prev) => prev.filter((user) => user.id !== userId));
    } catch (err) {
      console.error('Failed to delete user:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete user');
    }
  };

  const handleToggleAdmin = async (user: UserWithRole) => {
    if (!user.id) {
      console.error('handleToggleAdmin: user.id is undefined');
      return;
    }
    try {
      const { error } = await supabase
        .from('user_roles')
        .update({
          is_admin: !user.is_admin,
          role: !user.is_admin ? 'admin' : 'user',
        })
        .eq('user_id', user.id);
      if (error) throw error;
      setUsers((prev) =>
        prev.map((u) =>
          u.id === user.id
            ? { ...u, is_admin: !u.is_admin, role: !u.is_admin ? 'admin' : 'user' }
            : u
        )
      );
    } catch (err) {
      console.error('Failed to toggle admin rights:', err);
      setError(err instanceof Error ? err.message : 'Failed to toggle admin rights');
    }
  };

  const handleShowTasks = async (userId: string, type: 'responsible' | 'coworker') => {
    try {
      // Get tasks based on type
      const { data: tasks } = await supabase
        .from('tasks')
        .select(`
          *,
          status:task_statuses(*)
        `)
        .or(
          type === 'responsible' 
            ? `responsible_id.eq.${userId}` 
            : `coworkers.cs.{${userId}}`
        );

      if (!tasks) return;

      setSelectedUserTasks({
        userId,
        type,
        tasks
      });

    } catch (err) {
      console.error('Failed to fetch user tasks:', err);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg p-4 bg-red-50 border border-red-100">
        <div className="flex items-center space-x-2">
          <Shield className="w-5 h-5 text-red-600" />
          <p className="text-sm text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white shadow-md rounded-lg overflow-hidden">
      <div className="px-4 py-5 sm:px-6">
        <h3 className="text-lg font-medium leading-6 text-gray-900">Users</h3>
        <p className="mt-1 max-w-2xl text-sm text-gray-500">
          List of all users in the system
        </p>
      </div>
      <div className="border-t border-gray-200">
        <ul role="list" className="divide-y divide-gray-200">
          {users.map((user, index) => (
            <li
              key={user.id || index}
              className={cn(
                "px-4 py-4 sm:px-6 transition-all duration-300 hover:bg-gray-50",
                newUserId === user.id && "animate-slide-in bg-green-50"
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <Link
                      to={`/users/${user.id}`}
                      className={cn(
                        "w-12 h-12 rounded-full flex items-center justify-center",
                        user.is_admin ? "bg-indigo-100" : "bg-gray-100"
                      )}
                    >
                      <User
                        className={cn(
                          "w-6 h-6",
                          user.is_admin ? "text-indigo-600" : "text-gray-600"
                        )}
                      />
                    </Link>
                  </div>
                  <div className="ml-4">
                    <div className="flex items-center space-x-2">
                      <Link to={`/users/${user.id}`} className="text-base font-medium text-gray-900 hover:text-indigo-600">
                        {userService.formatUserName(user)}
                      </Link>
                      {user.is_admin && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                          Admin
                        </span>
                      )}
                      <div className="flex items-center gap-2 ml-2">
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleShowTasks(user.id, 'responsible');
                          }}
                          className="px-2 py-0.5 text-xs font-medium rounded-full bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                        >
                          Responsible: {userTaskCounts[user.id]?.responsible || 0}
                        </button>
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleShowTasks(user.id, 'coworker');
                          }}
                          className="px-2 py-0.5 text-xs font-medium rounded-full bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
                        >
                          Co-worker: {userTaskCounts[user.id]?.coworker || 0}
                        </button>
                      </div>
                    </div>
                    <p className="text-sm text-gray-500">
                      <span className="text-gray-400">{user.email}</span>
                    </p>
                    <p className="text-xs text-gray-400">
                      Created {new Date(user.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => handleToggleAdmin(user)}
                    className={cn(
                      "px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2",
                      user.is_admin 
                        ? "bg-indigo-100 text-indigo-700 hover:bg-indigo-200"
                        : "bg-blue-100 text-blue-700 hover:bg-blue-200"
                    )}
                  >
                    <Shield className="w-4 h-4" />
                    {user.is_admin ? 'Remove Admin' : 'Make Admin'}
                  </button>
                  <button
                    onClick={() => handleDeleteUser(user.id)}
                    className="p-2 rounded-lg bg-red-100 text-red-600 hover:bg-red-200 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
      {selectedUserTasks && (
        <UserTasksModal
          isOpen={true}
          onClose={() => setSelectedUserTasks(null)}
          tasks={selectedUserTasks.tasks}
          type={selectedUserTasks.type}
          title={`Tasks where ${userService.formatUserName(users.find(u => u.id === selectedUserTasks.userId) || { id: '', email: 'Unknown', first_name: '', last_name: '' })} is ${selectedUserTasks.type === 'responsible' ? 'responsible' : 'a co-worker'}`}
        />
      )}
    </div>
  );
}