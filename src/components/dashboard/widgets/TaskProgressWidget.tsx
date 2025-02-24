import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart as ChartBar, Loader2 } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { cn } from '../../../lib/utils';

interface TaskProgress {
  total: number;
  completed: number;
  percentage: number;
  weeklyCompleted: number;
  weeklyTotal: number;
  weeklyPercentage: number;
}

export function TaskProgressWidget() {
  const [progress, setProgress] = useState<TaskProgress>({
    total: 0,
    completed: 0,
    percentage: 0,
    weeklyCompleted: 0,
    weeklyTotal: 0,
    weeklyPercentage: 0
  });
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    loadProgress();
  }, []);

  const loadProgress = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get all tasks where user is responsible
      const { data: tasks } = await supabase
        .from('tasks')
        .select('id, result, created_at')
        .eq('responsible_id', user.id);

      if (!tasks) return;

      // Calculate overall progress
      const total = tasks.length;
      const completed = tasks.filter(t => t.result).length;
      const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

      // Calculate weekly progress
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - 7);
      
      const weeklyTasks = tasks.filter(t => new Date(t.created_at) >= weekStart);
      const weeklyTotal = weeklyTasks.length;
      const weeklyCompleted = weeklyTasks.filter(t => t.result).length;
      const weeklyPercentage = weeklyTotal > 0 ? Math.round((weeklyCompleted / weeklyTotal) * 100) : 0;

      setProgress({
        total,
        completed,
        percentage,
        weeklyTotal,
        weeklyCompleted,
        weeklyPercentage
      });
    } catch (err) {
      console.error('Failed to load progress:', err);
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
            <h3 className="text-sm font-medium text-gray-900">Task Progress</h3>
            <p className="text-xs text-gray-500">Your completion rate</p>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {/* Overall Progress */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Overall Progress</span>
            <span className="text-sm font-medium text-indigo-600">{progress.percentage}%</span>
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div 
              className="h-full bg-indigo-500 rounded-full transition-all duration-500"
              style={{ width: `${progress.percentage}%` }}
            />
          </div>
          <div className="mt-1 flex items-center justify-between text-xs text-gray-500">
            <span>{progress.completed} completed</span>
            <span>{progress.total} total</span>
          </div>
        </div>

        {/* Weekly Progress */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">This Week</span>
            <span className="text-sm font-medium text-indigo-600">{progress.weeklyPercentage}%</span>
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div 
              className="h-full bg-indigo-500 rounded-full transition-all duration-500"
              style={{ width: `${progress.weeklyPercentage}%` }}
            />
          </div>
          <div className="mt-1 flex items-center justify-between text-xs text-gray-500">
            <span>{progress.weeklyCompleted} completed</span>
            <span>{progress.weeklyTotal} total</span>
          </div>
        </div>

        <button
          onClick={() => navigate('/tasks/my')}
          className={cn(
            "w-full px-4 py-2 text-sm font-medium rounded-lg",
            "bg-indigo-50 text-indigo-600 hover:bg-indigo-100",
            "transition-colors"
          )}
        >
          View All Tasks
        </button>
      </div>
    </div>
  );
}