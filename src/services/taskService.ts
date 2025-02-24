import { supabase } from '../lib/supabase';
import { taskActivityService } from './taskActivityService';
import type { Task } from '../components/dashboard/types';

export const taskService = {
  async updateDescription(taskId: string, newDescription: string) {
    try {
      // Check session first
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Authentication required');
      }

      // Get current task to compare description
      const { data: task, error: taskError } = await supabase
        .from('tasks')
        .select('description')
        .eq('id', taskId)
        .single();

      if (taskError) throw taskError;
      if (!task) throw new Error('Task not found');

      // Don't update if description hasn't changed
      if (task.description === newDescription) {
        return { success: true, message: 'No changes to save' };
      }

      // Update description
      const { error: updateError } = await supabase
        .from('tasks')
        .update({
          description: newDescription,
          updated_at: new Date().toISOString()
        })
        .eq('id', taskId);

      if (updateError) throw updateError;

      // Log activity
      await taskActivityService.logActivity({
        taskId,
        field: 'description',
        oldValue: task.description || '',
        newValue: newDescription,
        type: 'update'
      });

      return { success: true };
    } catch (err) {
      console.error('Failed to update description:', err);
      throw err;
    }
  },

  async getTask(taskId: string): Promise<Task> {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('id', taskId)
      .single();

    if (error) throw error;
    if (!data) throw new Error('Task not found');

    return data;
  },

  async updateTask(taskId: string, updates: Partial<Task>) {
    const { data, error } = await supabase
      .from('tasks')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', taskId)
      .select()
      .single();

    if (error) throw error;
    if (!data) throw new Error('Failed to update task');

    return data;
  }
};