import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, AlertTriangle } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { cn } from '../../../lib/utils';

interface Task {
  id: string;
  title: string;
  due_date: string;
  status: {
    name: string;
    color: string;
  };
}

export function UpcomingDeadlinesWidget() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    loadTasks();
  }, []);

  const loadTasks = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get tasks due in the next 7 days
      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);

      const { data: tasks } = await supabase
        .from('tasks')
        .select(`
          id,
          title,
          due_date,
          status:task_statuses(name, color)
        `)
        .or(`responsible_id.eq.${user.id},coworkers.cs.{${user.id}}`)
        .is('result', null)
        .lt('due_date', nextWeek.toISOString())
        .gte('due_date', new Date().toISOString())
        .order('due_date', { ascending: true })
        .limit(5);

      setTasks(tasks || []);
    } catch (err) {
      console.error('Failed to load tasks:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const isOverdue = (date: string) => {
    return new Date(date) < new Date();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    );
  }

  return (
    <div className="p-4 h-full">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center">
            <Calendar className="w-4 h-4 text-indigo-600" />
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-900">Upcoming Deadlines</h3>
            <p className="text-xs text-gray-500">Tasks due in the next 7 days</p>
          </div>
        </div>
      </div>

      <div className="space-y-3 h-[calc(100%-4rem)]">
        {tasks.map(task => (
          <div
            key={task.id}
            onClick={() => navigate(`/tasks/${task.id}`)}
            className={cn(
              "bg-gradient-to-br from-white to-gray-50/50 rounded-lg border shadow-sm hover:shadow-md transition-all p-3 cursor-pointer",
              isOverdue(task.due_date) 
                ? "border-red-200 hover:border-red-300" 
                : "hover:border-indigo-200 group"
            )}
          >
            <div className="flex items-center justify-between gap-4">
              <h4 className="text-sm font-medium text-gray-900 truncate group-hover:text-indigo-600">
                {task.title}
              </h4>
              <div
                className="px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap"
                style={{
                  backgroundColor: task.status.color,
                  color: 'white',
                  textShadow: '0 1px 2px rgba(0,0,0,0.1)'
                }}
              >
                {task.status.name}
              </div>
            </div>
            <div className={cn(
              "mt-2 flex items-center text-xs",
              isOverdue(task.due_date) ? "text-red-600" : "text-gray-500"
            )}>
              {isOverdue(task.due_date) ? (
                <AlertTriangle className="w-3.5 h-3.5 mr-1" />
              ) : (
                <Calendar className="w-3.5 h-3.5 mr-1" />
              )}
              {new Date(task.due_date).toLocaleDateString()}
            </div>
          </div>
        ))}

        {tasks.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center py-8">
            <Calendar className="w-8 h-8 text-gray-400 mx-auto mb-2" />
            <p className="text-sm text-gray-500">No upcoming deadlines</p>
          </div>
        )}
      </div>
    </div>
  );
}