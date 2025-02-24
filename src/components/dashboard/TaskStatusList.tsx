import { useState, useEffect } from 'react';
import { Loader2, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { cn } from '../../lib/utils';

interface TaskStatus {
  id: string;
  name: string;
  color: string;
  position: number;
}

export function TaskStatusList() {
  const [statuses, setStatuses] = useState<TaskStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchStatuses();
  }, []);

  const fetchStatuses = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from('task_statuses')
        .select('*')
        .order('position');

      if (error) throw error;
      setStatuses(data || []);
    } catch (err) {
      console.error('Failed to fetch statuses:', err);
      setError('Failed to load task statuses');
    } finally {
      setIsLoading(false);
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
          <AlertCircle className="w-5 h-5 text-red-600" />
          <p className="text-sm text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-lg border p-6">
      <h2 className="text-lg font-medium text-gray-900 mb-4">Task Statuses</h2>
      <div className="grid gap-4">
        {statuses.map((status) => (
          <div
            key={status.id}
            className={cn(
              "p-4 rounded-lg border flex items-center justify-between",
              "transition-all duration-200 hover:shadow-md"
            )}
            style={{ borderColor: status.color + '40' }}
          >
            <div className="flex items-center space-x-3">
              <div 
                className="w-4 h-4 rounded-full"
                style={{ backgroundColor: status.color }}
              />
              <span className="font-medium text-gray-900">{status.name}</span>
            </div>
            <div className="flex items-center space-x-4">
              <div 
                className="px-3 py-1 rounded text-sm"
                style={{ 
                  backgroundColor: status.color + '20',
                  color: status.color
                }}
              >
                Position: {status.position}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}