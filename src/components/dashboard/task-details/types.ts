import { z } from 'zod';
import { Database } from '../../../types/supabase';

export type Task = Database['public']['Tables']['tasks']['Row'];
export type TaskStatus = Database['public']['Tables']['task_statuses']['Row'];
export type Project = Database['public']['Tables']['projects']['Row'];
export type Comment = Database['public']['Tables']['task_comments']['Row'];

export const schema = z.object({
  title: z.string().min(1, 'Title is required').max(100, 'Title is too long'),
  description: z.string().optional(),
  due_date: z.string().optional().nullable(),
  status_id: z.string().uuid('Invalid status'),
  project_id: z.string().uuid('Invalid project').optional().nullable(),
  result: z.string().optional().nullable(),
});

export type FormData = z.infer<typeof schema>;

export interface TaskDetailsProps {
  task: Task;
  statuses: TaskStatus[];
  onClose: () => void;
  onUpdate: () => void;
}