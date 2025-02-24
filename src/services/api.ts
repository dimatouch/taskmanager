import { supabase } from '../lib/supabase';
import type { Task } from '../components/dashboard/types';

interface CreateTaskParams {
  title: string;
  description?: string;
  status_id: string;
  due_date?: string;
  project_id?: string;
  priority?: number;
  responsible_id?: string;
  coworkers?: string[];
  parent_id?: string;
  is_subtask?: boolean;
}

interface CreateIdeaParams {
  content: string;
  board_id?: string;
}

// Create a singleton instance with auth token
class ApiService {
  private static instance: ApiService;
  private baseUrl = 'https://ljkabmsuwjgigawvskuh.supabase.co/rest/v1';
  private apiKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  private constructor() {}

  public static getInstance(): ApiService {
    if (!ApiService.instance) {
      ApiService.instance = new ApiService();
    }
    return ApiService.instance;
  }

  private async getAuthHeaders(): Promise<HeadersInit> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('No authenticated session');
    }

    return {
      'apikey': this.apiKey,
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal'
    };
  }

  // Task Management
  async createTask(params: CreateTaskParams): Promise<Task> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('No authenticated user');

    const { data, error } = await supabase
      .from('tasks')
      .insert({
        ...params,
        owner_id: user.id,
        position: 0
      })
      .select()
      .single();

    if (error) throw error;
    if (!data) throw new Error('Failed to create task');

    return data;
  }

  async getTasks(filter?: 'my' | 'created' | 'recent'): Promise<Task[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('No authenticated user');

    let query = supabase.from('tasks').select(`
      *,
      status:task_statuses(*),
      project:projects(*)
    `);

    if (filter === 'created') {
      query = query.eq('owner_id', user.id);
    } else if (filter === 'my') {
      query = query.or(
        `responsible_id.eq.${user.id},coworkers.cs.{${user.id}}`
      );
    }

    query = query.order('created_at', { ascending: false });
    const { data, error } = await query;

    if (error) throw error;
    return data || [];
  }

  async updateTask(taskId: string, updates: Partial<Task>): Promise<Task> {
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

  async deleteTask(taskId: string): Promise<void> {
    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', taskId);

    if (error) throw error;
  }

  // Idea Management
  async createIdea(params: CreateIdeaParams) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('No authenticated user');

    const { data, error } = await supabase
      .from('ideas')
      .insert({
        content: params.content,
        user_id: user.id,
        board_id: params.board_id
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async getIdeas(boardId?: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('No authenticated user');

    let query = supabase
      .from('ideas')
      .select('*')
      .eq('user_id', user.id);

    if (boardId) {
      query = query.eq('board_id', boardId);
    }

    query = query.order('created_at', { ascending: false });
    const { data, error } = await query;

    if (error) throw error;
    return data || [];
  }

  async convertIdeaToTask(ideaId: string, taskData: CreateTaskParams) {
    const task = await this.createTask(taskData);

    // Mark idea as converted
    const { error } = await supabase
      .from('ideas')
      .update({
        converted_to_task: true,
        task_id: task.id
      })
      .eq('id', ideaId);

    if (error) throw error;
    return task;
  }

  async deleteIdea(ideaId: string) {
    const { error } = await supabase
      .from('ideas')
      .delete()
      .eq('id', ideaId);

    if (error) throw error;
  }
}

// Export singleton instance
export const api = ApiService.getInstance();