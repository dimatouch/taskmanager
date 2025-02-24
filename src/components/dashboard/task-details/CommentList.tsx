import { MessageSquare, ClipboardList } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { Comment } from './types';

interface CommentListProps {
  comments: Comment[];
  users: { id: string; email: string }[];
  showCommentType: 'all' | 'comments' | 'updates';
}

export function CommentList({ comments, users, showCommentType }: CommentListProps) {
  return (
    <div className="space-y-4">
      {comments
        .filter(comment =>
          showCommentType === 'all' || 
          (showCommentType === 'comments' && comment.type === 'comment') ||
          (showCommentType === 'updates' && comment.type === 'progress')
        )
        .map((comment) => (
          <div
            key={comment.id}
            className={cn(
              "rounded-lg p-4 shadow-sm",
              comment.type === 'progress' 
                ? 'bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100' 
                : 'bg-gradient-to-br from-gray-50 to-white border border-gray-100'
            )}
          >
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center">
                {comment.type === 'progress' ? (
                  <ClipboardList className="w-4 h-4 text-blue-500 mr-2" />
                ) : (
                  <MessageSquare className="w-4 h-4 text-gray-500 mr-2" />
                )}
                <span className="text-sm font-medium">
                  {users.find(u => u.id === comment.user_id)?.email || 'Unknown'}
                </span>
              </div>
              <span className="text-xs text-gray-500">
                {new Date(comment.created_at).toLocaleString()}
              </span>
            </div>
            <p className={cn(
              "text-sm",
              comment.type === 'progress' ? 'text-blue-700' : 'text-gray-700'
            )}>{comment.content}</p>
          </div>
        ))}
    </div>
  );
}