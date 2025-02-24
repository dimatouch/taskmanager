import { Loader2, CheckCircle2 } from 'lucide-react';
import { cn } from '../../../../lib/utils';
import { useTranslation } from '../../../../lib/i18n/useTranslation';
import type { Task } from '../types';

interface TaskFooterProps {
  onComplete: () => void;
  onReturnToWork: () => void;
  newComment: string;
  onCommentChange: (value: string) => void;
  onCommentSubmit: () => void;
  task: Task;
  statuses: any[];
  saveError?: string | null;
}

export function TaskFooter({
  onComplete,
  onReturnToWork,
  newComment,
  onCommentChange,
  onCommentSubmit,
  task,
  statuses,
  saveError
}: TaskFooterProps) {
  const { t } = useTranslation();
  const isDone = task.status_id === statuses.find(s => s.name === 'Done')?.id;

  return (
    <div className="sticky bottom-0 flex w-full border-t">
      {/* Comment input */}
      <div className="w-[70%] bg-white shadow-lg p-4">
        <input
          type="text"
          value={newComment}
          onChange={(e) => onCommentChange(e.target.value)}
          placeholder="Write a comment..."
          className={cn(
            "w-full rounded-lg text-sm px-4 py-3 border shadow-sm transition-all duration-200",
            "border-indigo-200 bg-white focus:border-indigo-500 focus:ring-indigo-500",
            "placeholder-gray-400"
          )}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              onCommentSubmit();
            }
          }}
        />
      </div>
      
      {/* Action buttons */}
      <div className="w-[30%] bg-white border-l shadow-lg flex items-center justify-center p-4">
        <div className="w-full">
          {isDone ? (
            <button
              type="button"
              onClick={onReturnToWork}
              className={cn(
                "w-full px-6 py-3 text-sm font-medium rounded-lg text-white flex items-center justify-center",
                "bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600",
                "shadow-md hover:shadow-lg transition-all duration-200",
                "border border-blue-600/20"
              )}
            >
              <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 12h12m0 0l-4-4m4 4l-4 4M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Return to Work
            </button>
          ) : (
            <button
              type="button"
              onClick={onComplete}
              className={cn(
                "w-full px-6 py-3 text-sm font-medium rounded-lg text-white flex items-center justify-center",
                "bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600",
                "shadow-md hover:shadow-lg transition-all duration-200",
                "border border-emerald-600/20"
              )}
            >
              <CheckCircle2 className="w-4 h-4 mr-2" /> Complete Task
            </button>
          )}
        </div>
      </div>
    </div>
  );
}