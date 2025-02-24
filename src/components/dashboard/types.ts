import { z } from 'zod';
import { Database } from '../../types/supabase';

export type Task = Database['public']['Tables']['tasks']['Row'];
export type TaskStatus = Database['public']['Tables']['task_statuses']['Row'];
export type Project = Database['public']['Tables']['projects']['Row'];
export type Comment = Database['public']['Tables']['task_comments']['Row'];

export interface SubtaskSuggestion {
  title: string;
  description: string | null;
  priority: number;
}

export interface QuickTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  statuses: TaskStatus[];
  users?: { id: string; email: string }[];
  parentTaskId?: string;
  initialFormState?: {
    title?: string;
    description?: string;
    status_id?: string;
    due_date?: string;
    project_id?: string | null;
    priority?: number;
    responsible?: string | null;
    coworkers?: string[];
  };
}

export interface SubtaskSuggestionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  task?: {
    id?: string;
    title: string;
    description: string | null;
  };
  statuses: TaskStatus[];
  users: { id: string; email: string }[];
  parentTaskId?: string;
}