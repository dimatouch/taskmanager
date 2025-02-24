import { Loader2, Send, MessageSquare, ClipboardList } from 'lucide-react';
import { cn } from '../../../lib/utils';

interface CommentInputProps {
  commentType: 'comment' | 'progress';
  newComment: string;
  setNewComment: (value: string) => void;
  isPostingComment: boolean;
  onAddComment: () => void;
  setCommentType: (type: 'comment' | 'progress') => void;
  showCommentType: 'all' | 'comments' | 'updates';
  setShowCommentType: (type: 'all' | 'comments' | 'updates') => void;
}

export function CommentInput({
  commentType,
  newComment,
  setNewComment,
  isPostingComment,
  onAddComment,
  setCommentType,
  showCommentType,
  setShowCommentType,
}: CommentInputProps) {
  return (
    <div className="sticky bottom-0 p-4 border-t bg-white shadow-lg mt-auto">
      <div className="flex items-center space-x-2 mb-3">
        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={() => setCommentType('comment')}
            className={cn(
              "px-3 py-1.5 rounded-full text-sm font-medium transition-all",
              commentType === 'comment'
                ? "bg-gray-100 text-gray-900 shadow-sm"
                : "text-gray-600 hover:bg-gray-100"
            )}
          >
            <MessageSquare className="w-4 h-4 inline-block mr-1" />
            Comment
          </button>
          <button
            type="button"
            onClick={() => setCommentType('progress')}
            className={cn(
              "px-3 py-1.5 rounded-full text-sm font-medium transition-all",
              commentType === 'progress'
                ? "bg-blue-50 text-blue-700 shadow-sm"
                : "text-gray-600 hover:bg-gray-100"
            )}
          >
            <ClipboardList className="w-4 h-4 inline-block mr-1" />
            Progress Update
          </button>
        </div>
        <div className="flex items-center space-x-1 ml-auto">
          <button
            type="button"
            onClick={() => setShowCommentType('all')}
            className={cn(
              "px-2 py-1 text-xs font-medium transition-all",
              showCommentType === 'all'
                ? "text-gray-900 underline underline-offset-4"
                : "text-gray-500 hover:text-gray-900"
            )}
          >All</button>
          <button
            type="button"
            onClick={() => setShowCommentType('comments')}
            className={cn(
              "px-2 py-1 text-xs font-medium transition-all",
              showCommentType === 'comments'
                ? "text-gray-900 underline underline-offset-4"
                : "text-gray-500 hover:text-gray-900"
            )}
          >Comments</button>
          <button
            type="button"
            onClick={() => setShowCommentType('updates')}
            className={cn(
              "px-2 py-1 text-xs font-medium transition-all",
              showCommentType === 'updates'
                ? "text-gray-900 underline underline-offset-4"
                : "text-gray-500 hover:text-gray-900"
            )}
          >Updates</button>
        </div>
      </div>
      <div className="flex items-center space-x-2">
        <input
          type="text"
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder={commentType === 'progress' ? "Share progress update..." : "Add a comment..."}
          className={cn(
            "flex-1 rounded-lg text-sm px-4 py-2.5 shadow-sm transition-all duration-200",
            commentType === 'progress' 
              ? "border-blue-200 bg-blue-50/50 focus:border-blue-500 focus:ring-blue-500 placeholder-blue-400" 
              : "border-gray-200 bg-gray-50/50 focus:border-indigo-500 focus:ring-indigo-500 placeholder-gray-400"
          )}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              onAddComment();
            }
          }}
        />
        <button
          type="button"
          onClick={onAddComment}
          disabled={isPostingComment || !newComment.trim()}
          className={cn(
            "p-2.5 rounded-lg text-white shadow-sm hover:shadow transition-all duration-200",
            commentType === 'progress'
              ? "bg-blue-500 hover:bg-blue-600"
              : "bg-indigo-500 hover:bg-indigo-600",
            "disabled:opacity-50"
          )}
        >
          {isPostingComment ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
        </button>
      </div>
    </div>
  );
}

export { CommentInput }