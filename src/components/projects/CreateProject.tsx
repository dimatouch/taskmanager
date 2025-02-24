import { useState } from 'react';
import { Loader2, FolderPlus, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { cn } from '../../lib/utils';

interface CreateProjectProps {
  onSuccess?: (project: { id: string; name: string; description: string | null }) => void;
  onCancel?: () => void;
  className?: string;
}

export function CreateProject({ onSuccess, onCancel, className }: CreateProjectProps) {
  const [projectName, setProjectName] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFocused, setIsFocused] = useState<'name' | 'description' | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectName.trim()) return;
    try {
      setIsSubmitting(true);
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) throw new Error('No authenticated user');

      // Get user's current company
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('current_company_id')
        .eq('user_id', user.id)
        .single();

      if (!profile?.current_company_id) {
        throw new Error('No current company selected');
      }

      const { data, error } = await supabase
        .from('projects')
        .insert({
          name: projectName.trim(),
          description: projectDescription.trim() || null,
          owner_id: user.id,
          company_id: profile.current_company_id
        })
        .select()
        .single();

      if (error) throw error;

      if (data) {
        onSuccess?.(data);
      }

      setProjectName('');
      setProjectDescription('');
    } catch (err) {
      console.error('Failed to create project:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={cn(
      "bg-white rounded-lg shadow-xl overflow-hidden mt-20",
      "transform transition-all duration-200 scale-100 animate-in zoom-in-95",
      className
    )}>
      <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center">
            <FolderPlus className="w-5 h-5 text-indigo-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900">Create New Project</h3>
        </div>
        {onCancel && (
          <button
            onClick={onCancel}
            className="p-1 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-500 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="p-6 space-y-6">
          <div className="space-y-4">
            <div>
              <label htmlFor="projectName" className="block text-sm font-medium text-gray-700 mb-1">
                Project Name
              </label>
              <input
                type="text"
                id="projectName"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                onFocus={() => setIsFocused('name')}
                onBlur={() => setIsFocused(null)}
                className={cn(
                  "w-full rounded-lg text-sm transition-all duration-200",
                  "border border-gray-200 shadow-sm",
                  "px-4 py-2.5 leading-relaxed",
                  "placeholder:text-gray-400",
                  "bg-white hover:bg-gray-50/50",
                  "focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 focus:outline-none",
                  isFocused === 'name' && "border-indigo-500 ring-2 ring-indigo-500/10 bg-white"
                )}
                placeholder="e.g., Website Redesign"
                required
                maxLength={100}
              />
              <div className="mt-1 flex justify-between items-center">
                <p className="text-xs text-gray-500">
                  Give your project a clear, descriptive name
                </p>
                <span className="text-xs text-gray-400">
                  {projectName.length}/100
                </span>
              </div>
            </div>
            <div>
              <label htmlFor="projectDescription" className="block text-sm font-medium text-gray-700 mb-1">
                Description <span className="text-gray-400">(Optional)</span>
              </label>
              <textarea
                id="projectDescription"
                value={projectDescription}
                onChange={(e) => setProjectDescription(e.target.value)}
                onFocus={() => setIsFocused('description')}
                onBlur={() => setIsFocused(null)}
                rows={4}
                className={cn(
                  "w-full rounded-lg text-sm transition-all duration-200",
                  "border border-gray-200 shadow-sm",
                  "px-4 py-3 leading-relaxed",
                  "placeholder:text-gray-400",
                  "resize-none",
                  "bg-white hover:bg-gray-50/50",
                  "focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 focus:outline-none",
                  isFocused === 'description' && "border-indigo-500 ring-2 ring-indigo-500/10 bg-white"
                )}
                placeholder="Describe the project's goals and scope..."
                maxLength={500}
              />
              <div className="mt-1 flex justify-between items-center">
                <p className="text-xs text-gray-500">
                A clear description will help team members understand the project's purpose.
                </p>
                <span className="text-xs text-gray-400">
                  {projectDescription.length}/500
                </span>
              </div>
            </div>
          </div>
        </div>
        
        <div className="px-6 py-4 bg-gray-50 border-t flex justify-end gap-3 mt-auto">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className={cn(
                "px-4 py-2 text-sm font-medium rounded-lg transition-colors",
                "text-gray-700 hover:text-gray-500",
                "bg-white border border-gray-200 shadow-sm",
                "hover:bg-gray-50"
              )}
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            disabled={isSubmitting || !projectName.trim()}
            className={cn(
              "px-4 py-2 text-sm font-medium rounded-lg",
              "bg-gradient-to-r from-indigo-600 to-indigo-700 text-white",
              "hover:from-indigo-500 hover:to-indigo-600",
              "shadow-sm hover:shadow",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              "flex items-center"
            )}
          >
            {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {isSubmitting ? 'Creating...' : 'Create Project'}
          </button>
        </div>
      </form>
    </div>
  );
}