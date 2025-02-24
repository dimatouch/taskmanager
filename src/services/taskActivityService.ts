import { supabase } from '../lib/supabase';
import type { Task, TaskStatus, Project } from '../components/dashboard/types';

type ActivityField = 
  | 'status' 
  | 'project' 
  | 'due_date' 
  | 'title' 
  | 'description' 
  | 'responsible' 
  | 'coworkers' 
  | 'result' 
  | 'comment';

interface ActivityLogParams {
  taskId: string;
  field: ActivityField;
  oldValue?: string | null;
  newValue?: string | null;
  type: 'update' | 'create' | 'delete' | 'comment' | 'progress';
}

export const taskActivityService = {
  async logActivity({ taskId, field, oldValue, newValue, type }: ActivityLogParams) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.id || !user?.email) throw new Error('No authenticated user');

      // First update the task table if needed
      if (type === 'update') {
        const updateData: Record<string, any> = {};
        
        switch (field) {
          case 'title':
            updateData.title = newValue;
            break;
          case 'description':
            updateData.description = newValue;
            break;
          case 'status':
            updateData.status_id = newValue;
            break;
          case 'due_date':
            updateData.due_date = newValue;
            break;
          case 'project':
            updateData.project_id = newValue;
            break;
          case 'priority':
            updateData.priority = parseInt(newValue || '0');
            break;
          case 'result':
            updateData.result = newValue;
            break;
          case 'responsible':
            updateData.responsible_id = newValue;
            break;
          case 'coworkers':
            updateData.coworkers = newValue && newValue !== 'no one'
              ? newValue.split(',').filter(id => 
                  id && id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
                )
              : [];
            break;
        }

        // Only update if we have data to update
        if (Object.keys(updateData).length > 0) {
          const { error: updateError } = await supabase
            .from('tasks')
            .update({
              ...updateData,
              updated_at: new Date().toISOString()
            })
            .eq('id', taskId);

          if (updateError) {
            console.error('Failed to update task:', updateError);
            throw updateError;
          }
        }
      }

      // Log activity
      const { error: activityError } = await supabase
        .from('task_activities')
        .insert({
          task_id: taskId,
          user_id: user.id,
          type,
          field,
          old_value: oldValue,
          new_value: newValue
        });

      if (activityError) {
        console.error('Failed to log activity:', activityError);
        throw activityError;
      }

      return true;
    } catch (err) {
      console.error('Failed to update task:', err);
      throw err;
    }
  },

  async logComment(taskId: string, content: string) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.id || !user?.email) throw new Error('No authenticated user');

      const { data: activity, error } = await supabase
        .from('task_activities')
        .insert({
          task_id: taskId, 
          user_id: user.id,
          type: 'comment',
          field: 'comment',
          new_value: content
        })
        .select()
        .single();

      if (error) {
        console.error('Failed to insert comment:', error);
        throw error;
      }

      return activity;
    } catch (err) {
      console.error('Failed to add comment:', err);
      throw err;
    }
  },

  async logProgress(taskId: string, content: string) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.id || !user?.email) throw new Error('No authenticated user');

      const { data: activity, error } = await supabase
        .from('task_activities')
        .insert({
          task_id: taskId,
          user_id: user.id,
          type: 'progress',
          field: 'progress',
          new_value: content
        })
        .select()
        .single();

      if (error) {
        console.error('Failed to insert progress update:', error);
        throw error;
      }

      return activity;
    } catch (err) {
      console.error('Failed to add progress update:', err);
      throw err;
    }
  },

  async getActivities(taskId: string) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return [];

      const { data, error } = await supabase
        .from('task_activities')
        .select('*')
        .eq('task_id', taskId)
        .order('created_at', { ascending: false });

      if (error) {
        if (!error.message.includes('Failed to fetch')) {
          console.error('Failed to fetch activities:', error);
        }
        return [];
      }
      
      return data || [];
    } catch (err) {
      // Only log if it's not a network error during auth
      if (!(err instanceof Error && err.message.includes('Failed to fetch'))) {
        console.error('Failed to fetch activities:', err);
      }
      return [];
    }
  }
};