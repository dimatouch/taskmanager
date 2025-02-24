import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Loader2, ArrowLeft, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useCompany } from '../contexts/CompanyContext';
import { TaskDetails } from '../components/dashboard/TaskDetails';
import { QuickTaskModal } from '../components/dashboard/QuickTaskModal';
import type { Task, TaskStatus } from '../components/dashboard/types';

export function TaskPage() {
  const { taskId } = useParams();
  const navigate = useNavigate();
  const { currentCompany } = useCompany();
  const location = useLocation();
  const isNewTask = taskId === 'new';
  const [task, setTask] = useState<Task | null>(null);
  const [statuses, setStatuses] = useState<TaskStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<{ message: string; isAuth?: boolean } | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        // Don't fetch task data for new task
        if (isNewTask) {
          const statusesData = await fetchStatuses();
          setStatuses(statusesData || []);
          setIsLoading(false);
          return;
        }

        setIsLoading(true);
        setError(null);

        // Check auth first
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          setError({ message: 'Please sign in to view tasks', isAuth: true });
          return;
        }

        // Fetch task and statuses in parallel
        const [taskData, statusesData] = await Promise.all([
          fetchTask(),
          fetchStatuses()
        ]);

        if (!taskData) {
          setError({ message: 'Task not found' });
          return;
        }

        setTask(taskData);
        setStatuses(statusesData || []);
      } catch (err) {
        // Only log if it's not a network error during auth
        if (!(err instanceof Error && err.message.includes('Failed to fetch'))) {
          console.error('Failed to load task:', err);
        }
        setError({ message: err instanceof Error ? err.message : 'Failed to load task' });
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, [taskId]);

  async function fetchTask() {
    if (!taskId) return;
    
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('id', taskId)
        .single();
      
      if (error) {
        throw new Error(error.message);
      }
      if (!data) {
        throw new Error('Task not found');
      }
      
      return data;
    } catch (err) {
      throw err;
    }
  }

  async function fetchStatuses() {
    try {
      const { data, error } = await supabase
        .from('task_statuses')
        .select('*')
        .order('position');
      
      if (error) {
        throw new Error(error.message);
      }
      
      return data;
    } catch (err) {
      throw err;
    }
  }

  if (isNewTask) {
    return (
      <div className="min-h-screen bg-gray-50 pt-4">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <button
            onClick={() => navigate(-1)}
            className="mb-6 inline-flex items-center px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 bg-white rounded-lg shadow-sm hover:shadow transition-all"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back
          </button>
          
          <div className="bg-white rounded-lg shadow-lg">
            <QuickTaskModal
              isOpen={true}
              onClose={() => navigate(-1)}
              onSuccess={() => navigate(-1)}
              statuses={statuses}
              users={[]}
            />
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (error || !task) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        {!error?.isAuth && (
          <button
            onClick={() => navigate(-1)}
            className="mb-6 inline-flex items-center px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 bg-white rounded-lg shadow-sm hover:shadow transition-all"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back
          </button>
        )}
        <div className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full">
          <div className="flex items-center justify-center w-12 h-12 mx-auto mb-4 rounded-full bg-red-100">
            <AlertCircle className="w-6 h-6 text-red-600" />
          </div>
          <h3 className="text-lg font-medium text-center text-gray-900 mb-2">
            {error?.isAuth ? 'Authentication Required' : 'Error Loading Task'}
          </h3>
          <div className="text-sm text-center text-gray-600 mb-6">
            <p>{error?.message || 'Task not found'}</p>
          </div>
          {error?.isAuth ? (
            <button
              onClick={() => window.location.reload()}
              className="w-full px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700"
            >
              Sign In
            </button>
          ) : (
            <button
              onClick={() => window.location.reload()}
              className="w-full px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700"
            >
              Try Again
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pt-4">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <button
          onClick={() => navigate(-1)}
          className="mb-6 inline-flex items-center px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 bg-white rounded-lg shadow-sm hover:shadow transition-all"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to Tasks
        </button>
        
        <div className="bg-white rounded-lg shadow-lg">
          <TaskDetails
            task={task}
            statuses={statuses}
            onClose={() => navigate(`/${currentCompany?.id}/tasks`)}
            onUpdate={fetchTask}
          />
        </div>
      </div>
    </div>
  );
}