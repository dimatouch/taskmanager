import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckSquare, Clock, AlertTriangle, Loader2, BarChart as ChartBar } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { cn } from '../../../lib/utils';

interface TaskStats {
  total: number;
  completed: number;
  active: number;
  overdue: number;
}

export function TaskStatsWidget() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<TaskStats>({
    total: 0,
    completed: 0,
    active: 0,
    overdue: 0
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get tasks where user is responsible
      const { data: tasks } = await supabase
        .from('tasks')
        .select('id, due_date, result')
        .eq('responsible_id', user.id);

      if (!tasks) return;

      const now = new Date();
      const stats = tasks.reduce((acc, task) => {
        acc.total++;

        if (task.result) {
          acc.completed++;
        } else {
          acc.active++;
          if (task.due_date && new Date(task.due_date) < now) {
            acc.overdue++;
          }
        }

        return acc;
      }, { total: 0, completed: 0, active: 0, overdue: 0 });

      setStats(stats);
    } catch (err) {
      console.error('Failed to load task stats:', err);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="p-4 h-full">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center">
            <ChartBar className="w-4 h-4 text-indigo-600" />
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-900">Task Statistics</h3>
            <p className="text-xs text-gray-500">Your task completion metrics</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <button
          onClick={() => navigate('/tasks/my', { 
            state: { 
              filter: 'completed',
              responsible: true 
            } 
          })}
          className={cn(
            "bg-gradient-to-br from-emerald-50 to-emerald-50/50 rounded-lg p-4 text-left",
            "hover:shadow-md transition-all duration-200",
            "hover:from-emerald-100/50 hover:to-emerald-50/60"
          )}
        >
          <div className="flex items-center justify-between">
            <CheckSquare className="w-5 h-5 text-emerald-600" />
            <span className="text-lg font-semibold text-emerald-600">
              {stats.completed}
            </span>
          </div>
          <p className="mt-1 text-xs text-emerald-600 font-medium">Completed</p>
          <div className="mt-2 text-[10px] text-emerald-500">
            {Math.round((stats.completed / stats.total) * 100)}% completion rate
          </div>
        </button>

        <button
          onClick={() => navigate('/tasks/my', { 
            state: { 
              filter: 'active',
              responsible: true,
              excludeOverdue: true
            } 
          })}
          className={cn(
            "bg-gradient-to-br from-blue-50 to-blue-50/50 rounded-lg p-4 text-left",
            "hover:shadow-md transition-all duration-200",
            "hover:from-blue-100/50 hover:to-blue-50/60"
          )}
        >
          <div className="flex items-center justify-between">
            <Clock className="w-5 h-5 text-blue-600" />
            <span className="text-lg font-semibold text-blue-600">
              {stats.active}
            </span>
          </div>
          <p className="mt-1 text-xs text-blue-600 font-medium">Active</p>
          <div className="mt-2 text-[10px] text-blue-500">
            {Math.round((stats.active / stats.total) * 100)}% of total tasks
          </div>
        </button>

        <button
          onClick={() => navigate('/tasks/my', { 
            state: { 
              filter: 'overdue',
              responsible: true,
              result: false
            } 
          })}
          className={cn(
            "col-span-2 bg-gradient-to-br from-amber-50 to-amber-50/50 rounded-lg p-4 text-left",
            "hover:shadow-md transition-all duration-200",
            "hover:from-amber-100/50 hover:to-amber-50/60"
          )}
        >
          <div className="flex items-center justify-between">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
            <span className="text-lg font-semibold text-amber-600">
              {stats.overdue}
            </span>
          </div>
          <p className="mt-1 text-xs text-amber-600 font-medium">Overdue</p>
          <div className="mt-2 text-[10px] text-amber-500">
            {Math.round((stats.overdue / stats.total) * 100)}% of active tasks
          </div>
        </button>
      </div>
    </div>
  );
}