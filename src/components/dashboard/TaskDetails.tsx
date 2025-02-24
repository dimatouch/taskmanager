import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEditor } from '@tiptap/react';
import { TaskViewers } from './task-details/components/TaskViewers';
import { RichTextToolbar } from './task-details/components/RichTextToolbar';
import { useCompany } from '../../contexts/CompanyContext'; 
import { useLocation, useNavigate } from 'react-router-dom';
import { taskActivityService } from '../../services/taskActivityService';
import { sanitizeFilename } from '../../lib/utils';
import { extensions } from './task-details/extensions';
import { cn } from '../../lib/utils';
import { supabase } from '../../lib/supabase';
import { ActivityList } from './ActivityList';
import { SubtaskList } from './task-details/SubtaskList';
import { 
  TaskHeader,
  TaskDescription,
  TaskSidebar,
  TaskFooter,
  TaskResultModal,
  TaskContent
} from './task-details';
import { TaskDetailsProps, schema, type FormData } from './task-details/types';
import { useTranslation } from '../../lib/i18n/useTranslation';
import { QuickTaskModal } from './QuickTaskModal';

const SAVE_TIMEOUT = 30000; // 30 seconds timeout

const formatDateForForm = (date: string | null) => {
  if (!date) return '';
  try {
    return new Date(date).toISOString().split('T')[0];
  } catch {
    return '';
  }
};

export function TaskDetails({ task: initialTask, statuses, onClose, onUpdate }: TaskDetailsProps) {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();

  if (!initialTask) {
    return (
      <div className="p-4 text-center">
        <p>Task not found</p>
      </div>
    );
  }

  const { currentCompany } = useCompany();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [users, setUsers] = useState<{ id: string; email: string }[]>([]);
  const [responsible, setResponsible] = useState<string | null>(initialTask.responsible_id);
  const [coworkers, setCoworkers] = useState<string[]>(initialTask.coworkers || []);
  const [selectedStatus, setSelectedStatus] = useState(initialTask.status_id || statuses[0]?.id);
  const [hasChanges, setHasChanges] = useState(false);
  const [creator, setCreator] = useState<{ email: string } | null>(null);
  const [isDone, setIsDone] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [isPostingComment, setIsPostingComment] = useState(false);
  const [showResultModal, setShowResultModal] = useState(false);
  const [resultInput, setResultInput] = useState('');
  const [isQuickTaskOpen, setIsQuickTaskOpen] = useState(false);
  const [task, setTask] = useState(initialTask);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [showQuickAddModal, setShowQuickAddModal] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: initialTask.title,
      description: initialTask.description || '',
      due_date: formatDateForForm(initialTask.due_date),
      status_id: initialTask.status_id,
      project_id: initialTask.project_id || '',
      result: initialTask.result || '',
    },
  });

  const editor = useEditor(useMemo(() => ({
    extensions,
    content: initialTask.description || '',
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
      const taskAssignees = initialTask.assignees || [];
      
      const hasFormChanges =
        value.title !== initialTask.title ||
        value.description !== initialTask.description ||
        value.due_date !== (initialTask.due_date ? new Date(initialTask.due_date).toISOString().split('T')[0] : '') ||
        value.project_id !== initialTask.project_id ||
        selectedStatus !== initialTask.status_id ||
        JSON.stringify(currentAssignees.sort()) !== JSON.stringify(taskAssignees.sort());
        
      setHasChanges(hasFormChanges);
    });
    return () => subscription.unsubscribe();
  }, [watch, selectedStatus, initialTask, responsible, coworkers]);

  useEffect(() => {
    fetchInitialData();
    // Check if task is done
    if (task && statuses.length > 0) {
      const doneStatus = statuses.find(s => s.name === 'Done');
      setIsDone(doneStatus ? task.status_id === doneStatus.id : false);
    }
  }, []);

  const fetchInitialData = async () => {
    await Promise.all([
      fetchProjects(),
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

  async function fetchProjects() {
    const { data } = await supabase.from('projects').select('*');
    if (data) setProjects(data);
  }

  async function fetchUsers() {
    try {
      const { data: profiles, error } = await supabase
        .from('user_profiles')
        .select('*');

      if (error) throw error;
      
      if (profiles) {
        setUsers(profiles.map(profile => ({
          id: profile.user_id,
          email: profile.email,
          first_name: profile.first_name || '',
          last_name: profile.last_name || ''
        })));
      }
    } catch (err) {
      console.error('Failed to fetch users:', err);
    }
  }

  async function fetchAssignees() {
    setResponsible(initialTask.responsible_id);
    setCoworkers(initialTask.coworkers || []);
  }

  const handleCommentSubmit = async () => {
    if (!newComment.trim()) return;
    setIsPostingComment(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) throw new Error('No authenticated user');

      const { error } = await supabase
        .from('task_activities')
        .insert({
          task_id: task.id,
          user_id: session.user.id,
          field: 'comment',
          new_value: newComment.trim(),
          type: 'comment',
        });

      if (error) throw error;
      
      setNewComment('');
      onUpdate();
    } catch (err) {
      console.error('Error posting comment:', err);
    } finally {
      setIsPostingComment(false);
    }
  };

  const handleReturnToWork = async () => {
    try {
      setIsSubmitting(true);
      setSaveError(null);

      // Get default status (first one if In Progress not found)
      const defaultStatus = statuses.find(s => s.name === 'In Progress') || statuses[0];
      if (!defaultStatus) throw new Error('No valid status found');

      const { error: taskError } = await supabase
        .from('tasks')
        .update({
          status_id: defaultStatus.id,
          result: null,
          updated_at: new Date().toISOString(),
          company_id: currentCompany?.id
        })
        .eq('id', task.id);

      if (taskError) throw taskError;

      // Log activity
      await taskActivityService.logActivity({
        taskId: task.id,
        field: 'status',
        oldValue: initialTask.status_id,
        newValue: defaultStatus.id,
        type: 'update'
      });

      // Update local state
      setTask(prev => ({
        ...prev,
        status_id: defaultStatus.id,
        result: null
      }));

      onUpdate();
    } catch (err) {
      console.error('Failed to return task to work:', err);
      setSaveError(err instanceof Error ? err.message : 'Failed to return task to work');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleComplete = async () => {
    try {
      setIsSubmitting(true);
      setSaveError(null);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No authenticated user');
      
      if (!resultInput.trim()) {
        throw new Error('Please enter a result');
      }

      if (!currentCompany?.id) {
        throw new Error('No company selected');
      }

      // Find Done status
      const doneStatus = statuses.find(s => s.name === 'Done');
      if (!doneStatus) throw new Error('Done status not found');

      // Upload files first
      const uploadedFiles = [];
      for (const file of files) {
        // Validate file size
        if (file.size > 52428800) { // 50MB
          throw new Error(`File ${file.name} is too large (max 50MB)`);
        }

        // Sanitize filename
        const sanitizedName = sanitizeFilename(file.name);
        const filePath = `${user.id}/${task.id}/${sanitizedName}`;

        const { data, error: uploadError } = await supabase.storage
          .from('task-attachments')
          .upload(filePath, file, {
            cacheControl: '31536000', // 1 year cache
            upsert: true
          });

        if (uploadError) throw uploadError;

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('task-attachments')
          .getPublicUrl(filePath);

        uploadedFiles.push({
          id: data.path,
          name: sanitizedName,
          path: filePath,
          url: publicUrl,
          size: file.size,
          type: file.type,
          uploaded_by: user.id,
          uploaded_at: new Date().toISOString()
        });
      }

      // Get existing files
      const existingFiles = task.files || [];

      // Combine existing and new files, ensuring no duplicates by path
      const allFiles = [
        ...existingFiles.filter(ef => !uploadedFiles.some(uf => uf.path === ef.path)),
        ...uploadedFiles
      ];

      const { error: taskError } = await supabase
        .from('tasks')
        .update({
          status_id: doneStatus.id,
          result: resultInput,
          updated_at: new Date().toISOString(),
          company_id: currentCompany?.id,
          files: allFiles
        })
        .eq('id', task.id);

      if (taskError) throw taskError;

      // Log file attachments
      for (const file of uploadedFiles) {
        await taskActivityService.logActivity({
          taskId: task.id,
          field: 'attachment',
          newValue: JSON.stringify(file),
          type: 'attachment'
        });
      }

      // Log activity
      await taskActivityService.logActivity({
        taskId: task.id,
        field: 'result',
        oldValue: initialTask.result,
        newValue: resultInput,
        type: 'update'
      });

      // Update local state
      setTask(prev => ({
        ...prev,
        status_id: doneStatus.id,
        result: resultInput
      }));

      onUpdate();
      setShowResultModal(false);
      setResultInput('');
    } catch (err) {
      console.error('Failed to complete task:', err);
      setSaveError(err instanceof Error ? err.message : 'Failed to complete task');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubtaskCreated = useCallback(async (newTask: Task) => {
    const { data: updatedTask, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('id', initialTask.id)
      .single();

    if (error) {
      console.error('Error updating task:', error);
      return;
    }

    if (updatedTask && onUpdate) {
      onUpdate(updatedTask);
    }
  }, [initialTask.id, onUpdate]);

  const handleClose = () => {
    // Get the background location from state
    const background = location.state?.background;
    
    if (background) {
      // Return to the background location
      navigate(background.pathname + background.search, { 
        replace: true 
      });
    } else {
      // Fallback to tasks list if no background
      navigate(`/${currentCompany?.id}/tasks`);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-[2px] flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-[95vw] max-w-7xl h-[95vh] flex flex-col relative">
        <TaskViewers task={task} users={users} />
        <TaskHeader 
          register={register} 
          onClose={onClose}
          errors={errors}
          isSubtask={true}
          task={task}
          users={users}
          isQuickTaskOpen={isQuickTaskOpen}
          setIsQuickTaskOpen={setIsQuickTaskOpen}
        />

        <div className="flex flex-1 overflow-hidden">
          <div className="flex flex-col w-[70%] relative">
            <div className="flex-1 overflow-y-auto p-6 pb-[72px]">
              <TaskContent
                editor={editor}
                task={task}
                statuses={statuses}
                users={users}
                onSubtaskCreated={handleSubtaskCreated}
                isQuickTaskOpen={isQuickTaskOpen}
                setIsQuickTaskOpen={setIsQuickTaskOpen}
              />
            </div>
          </div>

          {/* Sidebar */}
          <TaskSidebar
            task={task}
            statuses={statuses}
            projects={projects}
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
          />
        </div>

        <div className="border-t bg-white shadow-lg">
          <TaskFooter
            onComplete={() => setShowResultModal(true)}
            onReturnToWork={handleReturnToWork}
            newComment={newComment}
            onCommentChange={setNewComment}
            onCommentSubmit={handleCommentSubmit}
            task={task}
            statuses={statuses}
            saveError={saveError}
          />
        </div>

        {showResultModal && (
          <TaskResultModal
            resultInput={resultInput}
            onResultChange={(e) => setResultInput(e.target.value)} 
            onClose={() => setShowResultModal(false)}
            onComplete={handleComplete}
            isSubmitting={isSubmitting}
            error={saveError}
            task={task}
            files={files}
            onFileChange={setFiles}
          />
        )}

        {showQuickAddModal && (
          <QuickTaskModal
            isOpen={showQuickAddModal}
            onClose={() => setShowQuickAddModal(false)}
            onSuccess={handleSubtaskCreated}
            statuses={statuses}
            users={users}
            parentTaskId={initialTask.id}
            companyId={initialTask.company_id}
          />
        )}
      </div>
    </div>
  );
}