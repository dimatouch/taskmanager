import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, X, ChevronRight, AlertCircle } from 'lucide-react';
import { cn } from '../../lib/utils';
import { taskFormatterService } from '../../services/taskFormatterService';
import { QuickTaskModal } from '../dashboard/QuickTaskModal';

interface IdeaToTaskModalProps {
  idea: {
    id: string;
    content: string;
  };
  onClose: () => void;
  onSuccess: () => void;
  statuses: any[];
  users: any[];
}

export function IdeaToTaskModal({ idea, onClose, onSuccess, statuses, users }: IdeaToTaskModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formattedTask, setFormattedTask] = useState<any | null>(null);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [editedContent, setEditedContent] = useState(idea.content);
  const [isEditing, setIsEditing] = useState(false);

  const handleFormat = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const formatted = await taskFormatterService.formatIdea(idea.content);
      setFormattedTask(formatted);
      setShowTaskModal(true);
    } catch (err) {
      console.error('Failed to format idea:', err);
      setError(err instanceof Error ? err.message : 'Failed to format idea');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-[2px] flex items-start justify-center p-4 z-[60] animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-white rounded-lg shadow-xl mt-16">
        <div className="p-4 flex items-center justify-between border-b">
          <h2 className="text-lg font-medium text-gray-900">
            Convert Idea to Task
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-500"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4">
          <div className="bg-gray-50 rounded-lg p-4 mb-4">
            <h3 className="text-sm font-medium text-gray-700 mb-2">Original Idea</h3>
            {isEditing ? (
              <textarea
                value={editedContent}
                onChange={(e) => setEditedContent(e.target.value)}
                onBlur={() => {
                  if (editedContent.trim()) {
                    setIsEditing(false);
                  } else {
                    setIsEditing(false);
                    setEditedContent(idea.content);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    setIsEditing(false);
                  }
                  if (e.key === 'Escape') {
                    setIsEditing(false);
                    setEditedContent(idea.content);
                  }
                }}
                className={cn(
                  "w-full text-sm bg-white rounded-lg border-0 ring-1 ring-gray-200",
                  "focus:ring-2 focus:ring-indigo-500 focus:outline-none",
                  "p-3 min-h-[100px] resize-none",
                  "placeholder:text-gray-400"
                )}
                placeholder="Write your idea..."
                autoFocus
              />
            ) : (
              <div
                onClick={() => setIsEditing(true)}
                className="text-sm text-gray-600 whitespace-pre-wrap cursor-text hover:bg-white rounded p-3 -m-3"
              >
                {editedContent}
              </div>
            )}
          </div>

          {error && (
            <div className="mb-4 p-4 bg-red-50 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <div className="flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              Cancel
            </button>
            <button
              onClick={handleFormat}
              disabled={isLoading}
              className={cn(
                "px-4 py-2 text-sm font-medium rounded-lg",
                "bg-indigo-600 text-white hover:bg-indigo-700",
                "disabled:opacity-50 disabled:cursor-not-allowed",
                "flex items-center gap-2"
              )}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Formatting...
                </>
              ) : (
                <>
                  <ChevronRight className="w-4 h-4" />
                  Format & Convert
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {showTaskModal && formattedTask && (
        <QuickTaskModal
          isOpen={true}
          onClose={() => {
            setShowTaskModal(false);
            onClose();
          }}
          onSuccess={onSuccess}
          statuses={statuses}
          users={users}
          initialFormState={{
            title: formattedTask.title,
            description: formattedTask.description,
            status_id: statuses[0]?.id,
            due_date: formattedTask.suggestedDueDate,
            project_id: null,
            priority: formattedTask.priority,
            responsible: null,
            coworkers: []
          }}
        />
      )}
    </div>
  );
}