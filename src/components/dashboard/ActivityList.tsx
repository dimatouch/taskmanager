import { useState, useEffect, useRef, useCallback } from 'react';
import { Clock, Trash2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { supabase } from '../../lib/supabase';
import { userService } from '../../services/userService';

interface ActivityListProps {
  taskId: string;
  users: { id: string; email: string }[];
}

export interface Activity {
  id: string;
  user_id: string;
  type: string;
  field: string;
  old_value: string | null;
  new_value: string | null;
  created_at: string;
}

export function ActivityList({ taskId, users }: ActivityListProps) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; rect: DOMRect } | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout>();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const activitiesRef = useRef<Activity[]>([]);

  const fetchActivities = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError('Authentication required');
        return;
      }

      const { data: fetchedActivities, error } = await supabase
        .from('task_activities')
        .select('*')
        .eq('task_id', taskId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (fetchedActivities) {
        activitiesRef.current = fetchedActivities;
        setActivities(fetchedActivities);
      }
    } catch (err) {
      if (err instanceof Error && err.message.includes('Failed to fetch')) {
        setError('Connection error. Please check your internet connection.');
      } else {
        setError('Failed to load activities');
        console.error('Activity fetch error:', err);
      }
    } finally {
      setIsLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    fetchActivities();

    const channel = supabase.channel('activities-channel');
    channel
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'task_activities',
          filter: `task_id=eq.${taskId}`
        },
        (payload) => {
          setActivities((prev) => {
            switch (payload.eventType) {
              case 'INSERT': {
                const exists = activitiesRef.current.some(
                  (activity) => activity.id === payload.new.id
                );
                if (exists) return prev;
                
                const newActivities = [payload.new, ...prev];
                activitiesRef.current = newActivities;
                return newActivities;
              }
              case 'UPDATE': {
                const updated = payload.new;
                const newActivities = prev.map((activity) =>
                  activity.id === updated.id ? updated : activity
                );
                activitiesRef.current = newActivities;
                return newActivities;
              }
              case 'DELETE': {
                const newActivities = prev.filter(
                  (activity) => activity.id !== payload.old.id
                );
                activitiesRef.current = newActivities;
                return newActivities;
              }
              default:
                return prev;
            }
          });
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [taskId, fetchActivities]);

  const handleDelete = async (activity: Activity, confirmed = false) => {
    if (!confirmed) {
      const button = document.querySelector(`[data-activity-id="${activity.id}"]`) as HTMLElement;
      if (button) {
        const rect = button.getBoundingClientRect();
        setDeleteConfirm({ id: activity.id, rect });
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => {
          setDeleteConfirm(null);
        }, 3000);
      }
      return;
    }
    setDeleteConfirm(null);
    try {
      const { error } = await supabase
        .from('task_activities')
        .delete()
        .eq('id', activity.id);
      if (error) throw error;
      
      const newActivities = activities.filter((a) => a.id !== activity.id);
      activitiesRef.current = newActivities;
      setActivities(newActivities);
    } catch (err) {
      console.error('Failed to delete activity:', err);
    }
  };

  const formatActivityMessage = (activity: Activity) => {
    const formatUser = (id: string | null) => {
      if (!id) return 'no one';
      const user = users.find((u) => u.id === id);
      return user ? userService.formatUserName(user) : id;
    };

    const formatCoworkers = (value: string | null) => {
      if (!value) return 'no one';
      const coworkerIds = value.split(',').filter(Boolean);
      if (coworkerIds.length === 0) return 'no one';
      const validCoworkers = coworkerIds
        .map((id) => {
          const user = users.find((u) => u.id === id);
          return user ? userService.formatUserName(user) : null;
        })
        .filter(Boolean);
      return validCoworkers.length > 0 ? validCoworkers.join(', ') : 'no one';
    };

    if (activity.type === 'comment' || activity.type === 'progress') {
      return activity.new_value;
    }

    switch (activity.field) {
      case 'status':
        return (
          <span>
            changed status from{' '}
            <span className="font-medium text-gray-800">
              {activity.old_value || 'none'}
            </span>{' '}
            to{' '}
            <span className="font-medium text-gray-800">
              {activity.new_value}
            </span>
          </span>
        );
      case 'project':
        return (
          <span>
            {activity.old_value ? 'changed' : 'set'} project from{' '}
            <span className="font-medium text-gray-800">
              {activity.old_value || 'none'}
            </span>{' '}
            to{' '}
            <span className="font-medium text-gray-800">
              {activity.new_value}
            </span>
          </span>
        );
      case 'due_date':
        return (
          <span>
            {activity.old_value ? 'changed' : 'set'} due date from{' '}
            <span className="font-medium text-gray-800">
              {activity.old_value || 'none'}
            </span>{' '}
            to{' '}
            <span className="font-medium text-gray-800">
              {activity.new_value}
            </span>
          </span>
        );
      case 'title':
        return (
          <span>
            changed title from{' '}
            <span className="font-medium text-gray-800">
              {activity.old_value || 'none'}
            </span>{' '}
            to{' '}
            <span className="font-medium text-gray-800">
              {activity.new_value}
            </span>
          </span>
        );
      case 'description':
        return (
          <span>
            updated description
            {activity.old_value && activity.new_value && (
              <div className="mt-1 text-xs">
                <div className="bg-red-50 p-2 rounded-md mb-1">
                  <span className="text-red-600">- {activity.old_value}</span>
                </div>
                <div className="bg-green-50 p-2 rounded-md">
                  <span className="text-green-600">+ {activity.new_value}</span>
                </div>
              </div>
            )}
          </span>
        );
      case 'assignees':
        return (
          <span>
            changed assignees from{' '}
            <span className="font-medium text-gray-800">
              {formatCoworkers(activity.old_value)}
            </span>{' '}
            to{' '}
            <span className="font-medium text-gray-800">
              {formatCoworkers(activity.new_value)}
            </span>
          </span>
        );
      case 'responsible':
        return (
          <span>
            {activity.old_value ? 'changed responsible from ' : 'assigned '}
            {activity.old_value && (
              <>
                <span className="font-medium text-gray-800">
                  {formatUser(activity.old_value)}
                </span>{' '}
                to{' '}
              </>
            )}
            <span className="font-medium text-gray-800">
              {formatUser(activity.new_value)}
            </span>{' '}
            as responsible
          </span>
        );
      case 'co-workers': {
        const oldCoworkers = activity.old_value?.split(',').filter(Boolean) || [];
        const newCoworkers = activity.new_value?.split(',').filter(Boolean) || [];
        const added = newCoworkers
          .filter((id) => !oldCoworkers.includes(id))
          .map((id) => formatUser(id))
          .filter((name) => name !== 'Unknown');
        const removed = oldCoworkers
          .filter((id) => !newCoworkers.includes(id))
          .map((id) => formatUser(id))
          .filter((name) => name !== 'Unknown');
        
        if (added.length && removed.length) {
          return (
            <span>
              removed{' '}
              <span className="font-medium text-gray-800">
                {removed.join(', ')}
              </span>{' '}
              and added{' '}
              <span className="font-medium text-gray-800">
                {added.join(', ')}
              </span>{' '}
              as co-workers
            </span>
          );
        }
        
        if (added.length) {
          return (
            <span>
              added{' '}
              <span className="font-medium text-gray-800">
                {added.join(', ')}
              </span>{' '}
              as co-worker{added.length > 1 ? 's' : ''}
            </span>
          );
        }
        
        if (removed.length) {
          return (
            <span>
              removed{' '}
              <span className="font-medium text-gray-800">
                {removed.join(', ')}
              </span>{' '}
              from co-worker{removed.length > 1 ? 's' : ''}
            </span>
          );
        }
        
        return (
          <span>
            set{' '}
            <span className="font-medium text-gray-800">
              {formatCoworkers(activity.new_value || '')}
            </span>{' '}
            as co-worker{newCoworkers.length > 1 ? 's' : ''}
          </span>
        );
      }
      case 'result':
        return (
          <span>
            marked task as completed with result:{' '}
            <span className="font-medium text-gray-800">
              {activity.new_value}
            </span>
          </span>
        );
      default:
        return `${formatUser(activity.user_id)} updated ${activity.field}`;
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="animate-pulse">
            <div className="h-20 bg-gray-100 rounded-lg"></div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg p-4 bg-red-50 border border-red-100">
        <p className="text-sm text-red-600 text-center">{error}</p>
        <button
          onClick={fetchActivities}
          className="mt-2 w-full px-3 py-1.5 text-xs font-medium text-red-600 hover:text-red-700 bg-white rounded border border-red-200 hover:bg-red-50"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p className="text-sm">No activity yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {activities.map((activity) => (
        <div
          key={activity.id}
          className={cn(
            "rounded-lg p-3 border relative group flex items-start gap-3",
            activity.type === 'update' && activity.field === 'result'
              ? "bg-emerald-50/50 border-emerald-100"
              : activity.type === 'update'
              ? "bg-gray-50 border-gray-100"
              : activity.type === 'progress'
              ? "bg-blue-50/50 border-blue-100"
              : "bg-indigo-50/50 border-indigo-100"
          )}
        >
          <div
            className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium flex-shrink-0",
              activity.type === 'update' && activity.field === 'result'
                ? "bg-emerald-100/80 text-emerald-600"
                : activity.type === 'update'
                ? "bg-gray-100 text-gray-600"
                : activity.type === 'progress'
                ? "bg-blue-100/80 text-blue-600"
                : "bg-indigo-100/80 text-indigo-600"
            )}
          >
            {users.find(u => u.id === activity.user_id)?.email.charAt(0).toUpperCase() || '?'}
          </div>
          <div className="flex-1 min-w-0">
            {(activity.type === 'comment' || activity.type === 'progress') && (
              <div className="text-sm font-medium mb-1">
                {users.find(u => u.id === activity.user_id)
                  ? userService.formatUserName(users.find(u => u.id === activity.user_id)!)
                  : activity.user_id}
              </div>
            )}
            <p
              className={cn(
                "text-sm",
                activity.type === 'update' && activity.field === 'result'
                  ? "text-emerald-700"
                  : activity.type === 'update'
                  ? "text-gray-700"
                  : activity.type === 'progress'
                  ? "text-blue-700"
                  : "text-indigo-700"
              )}
            >
              <span className="font-medium">
                {users.find(u => u.id === activity.user_id)
                  ? userService.formatUserName(users.find(u => u.id === activity.user_id)!)
                  : 'Unknown'}
              </span>{' '}
              <span className="text-gray-600">
                {formatActivityMessage(activity)}
              </span>
            </p>
            <div className="flex items-center mt-1 text-xs text-gray-500">
              <Clock className="w-3 h-3 mr-1" />
              {new Date(activity.created_at).toLocaleString()}
            </div>
          </div>
          <button
            onClick={() => handleDelete(activity)}
            data-activity-id={activity.id}
            className="absolute right-2 bottom-2 p-1.5 rounded-full transition-all duration-200 hover:bg-red-50 hover:text-red-500 text-gray-400"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          {deleteConfirm?.id === activity.id && (
            <div
              className="absolute right-0 top-0 mt-10 bg-white rounded-lg shadow-lg border border-red-200 p-3 z-50 animate-in fade-in slide-in-from-top-1 duration-200"
              style={{
                width: '200px',
                transform: `translateX(${Math.min(0, window.innerWidth - (deleteConfirm.rect.right + 200))}px)`
              }}
            >
              <p className="text-sm text-gray-700 mb-3">Are you sure you want to delete this activity?</p>
              <div className="flex justify-end gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteConfirm(null);
                  }}
                  className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-800"
                >
                  Cancel
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(activity, true);
                  }}
                  className="px-3 py-1.5 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-md"
                >
                  Delete
                </button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default ActivityList;