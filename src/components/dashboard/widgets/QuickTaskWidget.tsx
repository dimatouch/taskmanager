import { useState } from 'react';
import { Plus, Loader2 } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { cn } from '../../../lib/utils';

export function QuickTaskWidget() {
  const [title, setTitle] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || isSubmitting) return;

    try {
      setIsSubmitting(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No authenticated user');

      // Get default status
      const { data: status } = await supabase
        .from('task_statuses')
        .select('id')
        .eq('name', 'To Do')
        .single();

      if (!status) throw new Error('No default status found');

      // Create task
      const { error } = await supabase
        .from('tasks')
        .insert({
          title: title.trim(),
          status_id: status.id,
          owner_id: user.id,
          position: 0
        });

      if (error) throw error;

      setTitle('');
    } catch (err) {
      console.error('Failed to create task:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-4 h-full">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center">
            <Plus className="w-4 h-4 text-indigo-600" />
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-900">Quick Task</h3>
            <p className="text-xs text-gray-500">Quickly add a new task</p>
          </div>
        </div>
      </div>

      <div className="bg-gradient-to-br from-gray-50 to-white rounded-lg border p-4">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Add new task..."
              className={cn(
                "w-full px-4 py-2 text-sm rounded-lg border transition-all",
                "bg-white border-gray-200",
                "focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500",
                "placeholder:text-gray-400"
              )}
            />
            <button
              type="submit"
              disabled={!title.trim() || isSubmitting}
              className={cn(
                "absolute right-2 top-1/2 -translate-y-1/2",
                "p-1.5 rounded-lg transition-colors",
                title.trim()
                  ? "bg-indigo-500 text-white hover:bg-indigo-600"
                  : "bg-gray-100 text-gray-400",
                "disabled:opacity-50 disabled:cursor-not-allowed"
              )}
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}