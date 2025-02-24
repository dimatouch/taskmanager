import React, { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { supabase } from '../../../lib/supabase';
import { taskActivityService } from '../../../services/taskActivityService';
import { TaskDetailsProps, schema, type FormData } from './types';
import { TaskHeader } from './components/TaskHeader';
import { TaskContent } from './components/TaskContent';
import { TaskSidebar } from './components/TaskSidebar';
import { TaskFooter } from './components/TaskFooter';
import { TaskResultModal } from './components/TaskResultModal';

const formatDateForForm = (date: string | null) => {
  if (!date) return '';
  try {
    return new Date(date).toISOString().split('T')[0];
  } catch {
    return '';
  }
};

export function SubtaskDetails({ task, statuses, onClose, onUpdate }: TaskDetailsProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [users, setUsers] = useState<{ id: string; email: string }[]>([]);
  const [responsible, setResponsible] = useState<string | null>(null);
  const [coworkers, setCoworkers] = useState<string[]>([]);
  const [selectedStatus, setSelectedStatus] = useState(task.status_id);
  const [hasChanges, setHasChanges] = useState(false);
  const [creator, setCreator] = useState<{ email: string } | null>(null);
  const [newComment, setNewComment] = useState('');
  const [isPostingComment, setIsPostingComment] = useState(false);
  const [showResultModal, setShowResultModal] = useState(false);
  const [resultInput, setResultInput] = useState('');
  const [isClosing, setIsClosing] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    reset,
    setValue,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: task.title,
      description: task.description || '',
      due_date: formatDateForForm(task.due_date),
      status_id: task.status_id,
      result: task.result || '',
    },
  });

  const editor = useEditor(useMemo(() => ({
    extensions: [
      StarterKit,
      TaskList.configure({ itemTypeName: 'taskItem', HTMLAttributes: { class: 'task-list-container' } }),
      TaskItem.configure({ nested: true, onReadOnlyChecked: false, HTMLAttributes: { class: 'task-item' } }),
    ],
    content: task.description || '',
    autofocus: 'end',
    editorProps: {
      attributes: { class: 'prose prose-sm focus:outline-none min-h-[120px] px-4 py-3' },
    },
    onUpdate: ({ editor }) => {
      register('description').onChange({ target: { value: editor.getHTML() } });
    },
  }), []));

  useEffect(() => {
    if (editor && task.description !== editor.getHTML()) {
      editor.commands.setContent(task.description || '');
    }
  }, [editor, task.description]);

  useEffect(() => {
    const subscription = watch((value) => {
      const currentAssignees = [responsible, ...coworkers].filter(Boolean);
      const taskAssignees = task.assignees || [];
      
      const hasFormChanges =
        value.title !== task.title ||
        value.description !== task.description ||
        value.due_date !== (task.due_date ? new Date(task.due_date).toISOString().split('T')[0] : '') ||
        selectedStatus !== task.status_id ||
        JSON.stringify(currentAssignees.sort()) !== JSON.stringify(taskAssignees.sort());
        
      setHasChanges(hasFormChanges);
    });
    return () => subscription.unsubscribe();
  }, [watch, selectedStatus, task, responsible, coworkers]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsClosing(true);
        // Close result modal if it's open
        if (showResultModal) {
          setShowResultModal(false);
          setIsClosing(false);
          return;
        }
        // Finally, close the main modal
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose, showResultModal]);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    await Promise.all([
      fetchUsers(),
      fetchCreator(),
      fetchAssignees(),
    ]);
  };

  async function fetchCreator() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setCreator({ email: user.email || 'Unknown' });
    } catch (err) {
      console.error('Failed to fetch creator:', err);
    }
  }

  async function fetchUsers() {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setUsers([
        { id: user.id, email: user.email || 'Me' },
        { id: '00000000-0000-0000-0000-000000000001', email: 'max@example.com' },
        { id: '00000000-0000-0000-0000-000000000002', email: 'polya@example.com' },
        { id: '00000000-0000-0000-0000-000000000003', email: 'dima@example.com' },
      ]);
    }
  }

  async function fetchAssignees() {
    try {
      const { data } = await supabase
        .from('task_assignees')
        .select('user_id')
        .eq('task_id', task.id)
        .order('created_at');
      
      if (data) {
        const assigneeIds = data.map(a => a.user_id);
        setResponsible(assigneeIds[0] || null);
        setCoworkers(assigneeIds.slice(1));
      }
    } catch (err) {
      console.error('Failed to fetch assignees:', err);
    }
  }

  const handleCommentSubmit = async () => {
    if (!newComment.trim()) return;
    setIsPostingComment(true);
    try {
      await taskActivityService.logActivity({
        taskId: task.id,
        field: 'comment',
        newValue: newComment,
        type: 'comment',
      });
      setNewComment('');
    } catch (err) {
      console.error('Error posting comment:', err);
    } finally {
      setIsPostingComment(false);
    }
  };

  const onSubmit = async (formData: FormData) => {
    try {
      setIsSubmitting(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No authenticated session');

      const newAssignees = [responsible, ...coworkers].filter(Boolean) as string[];
      
      // Prepare update data
      const updateData: Record<string, any> = {
        title: formData.title,
        description: formData.description,
        status_id: selectedStatus,
        due_date: formData.due_date ? new Date(formData.due_date).toISOString() : null,
        updated_at: new Date().toISOString()
      };

      // Update task with all fields
      const { data: updatedTask, error: taskError } = await supabase
        .from('tasks')
        .update(updateData)
        .eq('id', task.id)
        .select()
        .single();

      if (taskError) throw taskError;
      if (!updatedTask) throw new Error('Failed to update task');

      // Log activities for changes
      await logTaskChanges(formData, newAssignees);

      // Update assignees
      await updateAssignees(newAssignees);

      onUpdate();
      setHasChanges(false);
      reset(formData);
    } catch (err) {
      console.error('Failed to update subtask:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const logTaskChanges = async (formData: FormData, newAssignees: string[]) => {
    // Always log all field changes
    const changes = {
      title: { old: task.title, new: formData.title },
      description: { old: task.description, new: formData.description },
      due_date: { old: formatDateForForm(task.due_date), new: formData.due_date },
      status: { old: task.status_id, new: selectedStatus },
      assignees: { old: task.assignees?.join(','), new: newAssignees.join(',') }
    };

    // Log all changes
    for (const [field, values] of Object.entries(changes)) {
      await taskActivityService.logActivity({
        taskId: task.id,
        field: field as any,
        oldValue: values.old?.toString() || '',
        newValue: values.new?.toString() || '',
        type: 'update',
      });
    }
  };

  const updateAssignees = async (newAssignees: string[]) => {
    const { data: currentAssignees } = await supabase
      .from('task_assignees')
      .select('user_id')
      .eq('task_id', task.id);
    
    const currentIds = currentAssignees?.map(a => a.user_id) || [];
    
    if (JSON.stringify(currentIds.sort()) !== JSON.stringify(newAssignees.sort())) {
      // Remove existing assignees
      if (currentIds.length > 0) {
        await supabase
          .from('task_assignees')
          .delete()
          .eq('task_id', task.id);
      }

      // Add new assignees
      if (newAssignees.length > 0) {
        await supabase
          .from('task_assignees')
          .insert(
            newAssignees.map(userId => ({
              task_id: task.id,
              user_id: userId,
            }))
          );
      }
    }
  };

  const handleCompleteTask = async () => {
    try {
      setIsSubmitting(true);
      
      const { error: taskError } = await supabase
        .from('tasks')
        .update({
          status_id: statuses.find(s => s.name === 'Done')?.id,
          result: resultInput,
        })
        .eq('id', task.id);

      if (taskError) throw taskError;

      await taskActivityService.logActivity({
        taskId: task.id,
        field: 'result',
        oldValue: task.result,
        newValue: resultInput,
        type: 'update',
      });

      onUpdate();
      setShowResultModal(false);
      setResultInput('');
    } catch (err) {
      console.error('Failed to complete subtask:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl mt-8 h-[90vh] flex flex-col relative">
        <TaskHeader 
          register={register} 
          onClose={onClose}
          isSubtask={true}
        />

        <div className="flex flex-1 overflow-hidden">
          <TaskContent 
            editor={editor}
            task={task}
            users={users}
            isSubtask={true}
          />

          <TaskSidebar
            task={task}
            statuses={statuses}
            selectedStatus={selectedStatus}
            setSelectedStatus={setSelectedStatus}
            dueDate={watch('due_date')}
            onDueDateChange={(date) => setValue('due_date', date)}
            creator={creator}
            onAssigneesChange={(newResponsible, newCoworkers) => {
              setResponsible(newResponsible);
              setCoworkers(newCoworkers);
              setHasChanges(true);
            }}
            isSubtask={true}
          />
        </div>

        <TaskFooter
          isSubmitting={isSubmitting}
          onSubmit={handleSubmit(onSubmit)}
          onComplete={() => setShowResultModal(true)}
          newComment={newComment}
          onCommentChange={setNewComment}
          onCommentSubmit={handleCommentSubmit}
        />

        {showResultModal && (
          <TaskResultModal
            resultInput={resultInput}
            setResultInput={setResultInput}
            onClose={() => setShowResultModal(false)}
            onComplete={handleCompleteTask}
            isSubmitting={isSubmitting}
          />
        )}
      </div>
    </div>
  );
}