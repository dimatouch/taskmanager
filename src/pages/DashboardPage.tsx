import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  CheckSquare, 
  Clock, 
  Calendar,
  AlertTriangle,
  ChevronRight,
  MessageSquare,
  ClipboardList,
  Plus
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { cn } from '../lib/utils';
import { useTranslation } from '../lib/i18n/useTranslation';
import { useCompany } from '../contexts/CompanyContext';

interface UserStats {
  created_tasks: number;
  responsible_tasks: number;
  coworker_tasks: number;
  completed_tasks: number;
  overdue_tasks: number;
  total_activities: number;
  total_comments: number;
  total_progress_updates: number;
  completion_rate: number;
}

interface Task {
  id: string;
  title: string;
  due_date: string | null;
  status: {
    name: string;
    color: string;
  };
}

export function DashboardPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { currentCompany } = useCompany();
  const [stats, setStats] = useState<UserStats | null>(null);
  const [activeTasks, setActiveTasks] = useState<Task[]>([]);
  const [upcomingTasks, setUpcomingTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setIsLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch user statistics
      const { data: userStats } = await supabase
        .from('user_statistics')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (userStats) {
        setStats(userStats);
      }

      // Fetch active tasks
      const { data: tasks } = await supabase
        .from('tasks')
        .select(`
          id,
          title,
          due_date,
          status:task_statuses(name, color)
        `)
        .eq('responsible_id', user.id)
        .is('result', null)
        .order('created_at', { ascending: false })
        .limit(5);

      if (tasks) {
        setActiveTasks(tasks);
      }

      // Fetch upcoming deadlines
      const now = new Date();
      const weekLater = new Date();
      weekLater.setDate(now.getDate() + 7);

      const { data: upcoming } = await supabase
        .from('tasks')
        .select(`
          id,
          title,
          due_date,
          status:task_statuses(name, color)
        `)
        .eq('responsible_id', user.id)
        .is('result', null)
        .gte('due_date', now.toISOString())
        .lte('due_date', weekLater.toISOString())
        .order('due_date')
        .limit(5);

      if (upcoming) {
        setUpcomingTasks(upcoming);
      }

    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('sidebar.dashboard')}</h1>
          <p className="mt-1 text-sm text-gray-500">
            Огляд ваших завдань та активності
          </p>
        </div>
        <button
          onClick={() => navigate(`/${currentCompany?.id}/tasks/new`)}
          className={cn(
            "px-4 py-2 rounded-lg text-sm font-medium",
            "bg-indigo-600 text-white hover:bg-indigo-700",
            "shadow-sm hover:shadow",
            "flex items-center gap-2 transition-all"
          )}
        >
          <Plus className="w-4 h-4" />
          {t('tasks.addTask')}
        </button>
      </div>

      {/* Key Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
              <CheckSquare className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-emerald-600">
                {stats?.completed_tasks || 0}
              </div>
              <div className="text-sm text-gray-500">Завершені завдання</div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center">
              <Clock className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-indigo-600">
                {stats?.responsible_tasks || 0}
              </div>
              <div className="text-sm text-gray-500">Активні завдання</div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-amber-600">
                {stats?.overdue_tasks || 0}
              </div>
              <div className="text-sm text-gray-500">Прострочені</div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-blue-600">
                {stats?.total_comments || 0}
              </div>
              <div className="text-sm text-gray-500">Коментарі</div>
            </div>
          </div>
        </div>
      </div>

      {/* Active Tasks and Deadlines */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Active Tasks */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-medium text-gray-900">Активні завдання</h2>
            <button
              onClick={() => navigate(`/${currentCompany?.id}/tasks/my`)}
              className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
            >
              Переглянути всі
            </button>
          </div>
          <div className="space-y-4">
            {activeTasks.map(task => (
              <div
                key={task.id}
                onClick={() => navigate(`/${currentCompany?.id}/tasks/${task.id}`)}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div 
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: task.status.color }}
                  />
                  <span className="text-sm font-medium text-gray-900 truncate">
                    {task.title}
                  </span>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
              </div>
            ))}
            {activeTasks.length === 0 && (
              <div className="text-center py-4 text-gray-500">
                Немає активних завдань
              </div>
            )}
          </div>
        </div>

        {/* Upcoming Deadlines */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-medium text-gray-900">Найближчі дедлайни</h2>
            <button
              onClick={() => navigate(`/${currentCompany?.id}/tasks/my`)}
              className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
            >
              Переглянути всі
            </button>
          </div>
          <div className="space-y-4">
            {upcomingTasks.map(task => (
              <div
                key={task.id}
                onClick={() => navigate(`/${currentCompany?.id}/tasks/${task.id}`)}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-sm font-medium text-gray-900 truncate">
                    {task.title}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Calendar className="w-4 h-4" />
                  {new Date(task.due_date!).toLocaleDateString()}
                </div>
              </div>
            ))}
            {upcomingTasks.length === 0 && (
              <div className="text-center py-4 text-gray-500">
                Немає найближчих дедлайнів
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Activity Summary */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
            <ClipboardList className="w-5 h-5 text-gray-600" />
          </div>
          <div>
            <h2 className="text-lg font-medium text-gray-900">Загальна статистика</h2>
            <p className="text-sm text-gray-500">
              Ваша активність у системі
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <h3 className="text-sm font-medium text-gray-500 mb-2">Завдання</h3>
            <dl className="space-y-1">
              <div className="flex justify-between">
                <dt className="text-sm text-gray-600">Створено:</dt>
                <dd className="text-sm font-medium">{stats?.created_tasks || 0}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm text-gray-600">Відповідальний:</dt>
                <dd className="text-sm font-medium">{stats?.responsible_tasks || 0}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm text-gray-600">Співвиконавець:</dt>
                <dd className="text-sm font-medium">{stats?.coworker_tasks || 0}</dd>
              </div>
            </dl>
          </div>

          <div>
            <h3 className="text-sm font-medium text-gray-500 mb-2">Виконання</h3>
            <dl className="space-y-1">
              <div className="flex justify-between">
                <dt className="text-sm text-gray-600">Завершено:</dt>
                <dd className="text-sm font-medium">{stats?.completed_tasks || 0}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm text-gray-600">Прострочено:</dt>
                <dd className="text-sm font-medium">{stats?.overdue_tasks || 0}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm text-gray-600">Відсоток виконання:</dt>
                <dd className="text-sm font-medium">{stats?.completion_rate || 0}%</dd>
              </div>
            </dl>
          </div>

          <div>
            <h3 className="text-sm font-medium text-gray-500 mb-2">Активність</h3>
            <dl className="space-y-1">
              <div className="flex justify-between">
                <dt className="text-sm text-gray-600">Всього дій:</dt>
                <dd className="text-sm font-medium">{stats?.total_activities || 0}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm text-gray-600">Коментарі:</dt>
                <dd className="text-sm font-medium">{stats?.total_comments || 0}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm text-gray-600">Оновлення прогресу:</dt>
                <dd className="text-sm font-medium">{stats?.total_progress_updates || 0}</dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}