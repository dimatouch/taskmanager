import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lightbulb, ChevronRight, Loader2 } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { cn } from '../../../lib/utils';

interface Idea {
  id: string;
  content: string;
  created_at: string;
  converted_to_task: boolean;
}

export function MyIdeasWidget() {
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    loadIdeas();
  }, []);

  const loadIdeas = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: ideas } = await supabase
        .from('ideas')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5);

      setIdeas(ideas || []);
    } catch (err) {
      console.error('Failed to load ideas:', err);
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
            <Lightbulb className="w-4 h-4 text-indigo-600" />
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-900">My Ideas</h3>
            <p className="text-xs text-gray-500">Recent ideas and thoughts</p>
          </div>
        </div>
        <button
          onClick={() => navigate('/ideas')}
          className="text-xs text-indigo-600 hover:text-indigo-700 font-medium"
        >
          View All
        </button>
      </div>

      <div className="space-y-3">
        {ideas.map(idea => (
          <div
            key={idea.id}
            onClick={() => navigate('/ideas')}
            className={cn(
              "bg-white rounded-lg border shadow-sm hover:shadow-md transition-all p-3 cursor-pointer",
              "hover:border-indigo-200 group",
              idea.converted_to_task && "opacity-75"
            )}
          >
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm text-gray-900 line-clamp-2 group-hover:text-indigo-600">
                {idea.content}
              </p>
              <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-indigo-500 flex-shrink-0" />
            </div>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-xs text-gray-500">
                {new Date(idea.created_at).toLocaleDateString()}
              </span>
              {idea.converted_to_task && (
                <span className="text-xs text-emerald-600 font-medium">
                  Converted to task
                </span>
              )}
            </div>
          </div>
        ))}

        {ideas.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8">
            <Lightbulb className="w-8 h-8 text-gray-400 mb-2" />
            <p className="text-sm text-gray-500">No ideas yet</p>
          </div>
        )}
      </div>
    </div>
  );
}