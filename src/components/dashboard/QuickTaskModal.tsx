import { useState, useEffect, useRef, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '../../lib/supabase';
import { userService } from '../../services/userService';
import { sanitizeFilename } from '../../lib/utils';
import { useEditor, EditorContent } from '@tiptap/react';
import { Bold, Italic, List, ListOrdered, Quote, Code, Calendar, Paperclip, Loader2, X, User, ChevronDown, Flame, FolderKanban, Clock, ChevronLeft, ChevronRight, Image, FileText, File, Plus, AlertCircle, CheckCircle2 } from 'lucide-react';
import { RichTextToolbar } from './task-details/components/RichTextToolbar';
import StarterKit from '@tiptap/starter-kit';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { cn } from '../../lib/utils';
import { SubtaskSuggestionModal } from './SubtaskSuggestionModal';
import type { QuickTaskModalProps } from './types';
import { DueDatePicker } from './DueDatePicker';
import { useNavigate } from 'react-router-dom';

// ---------------------
// Схема валідації
// ---------------------
const schema = z.object({
  title: z.string().min(1, 'Title is required').max(100, 'Title is too long'),
  description: z.string().optional(),
  due_date: z.string().optional().nullable(),
  status_id: z.string().uuid('Invalid status'),
});
type FormData = z.infer<typeof schema>;

// Початкове значення dueDate (через 3 години)
const getDefaultDueDate = () => {
  const date = new Date();
  date.setHours(date.getHours() + 3);
  // Ensure the date is in full ISO format with time
  return date.toISOString().slice(0, 19) + 'Z';
};

// Оновлюємо інтерфейс для файлів
interface FileWithStatus extends File {
  id?: string;
  path?: string;
  url?: string;
  status?: 'uploading' | 'success' | 'error';
  file?: File; // Додаємо оригінальний файл
}

interface QuickTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (task: any) => void;
  statuses: Array<{ id: string; name: string }>;
  users: Array<{ id: string; email: string }>; // Prop for users
  parentTaskId?: string;
  companyId: string;
}

// Додайте новий компонент для анімації завантаження
const UploadingAnimation = () => (
  <div className="relative w-full h-1 bg-gray-100 overflow-hidden rounded-full">
    <div className="absolute inset-0 bg-blue-500/20"></div>
    <div 
      className="absolute inset-y-0 bg-blue-500 w-1/3 rounded-full animate-[loading_1s_ease-in-out_infinite]"
      style={{
        animation: 'loading 1s ease-in-out infinite',
      }}
    />
  </div>
);

// Додайте стилі для анімації в global.css або inline
const styles = `
  @keyframes loading {
    0% {
      transform: translateX(-100%);
    }
    50% {
      transform: translateX(100%);
    }
    100% {
      transform: translateX(-100%);
    }
  }
`;

// Оновлений компонент для файлу
const FilePreview = ({ file, onRemove, index }: { 
  file: FileWithStatus; 
  onRemove: (index: number) => void;
  index: number;
}) => (
  <div 
    className={cn(
      "inline-flex items-center gap-1 px-2 py-1 rounded-md text-sm",
      "border border-gray-100",
      file.status === 'uploading' && "bg-blue-50",
      file.status === 'success' && "bg-emerald-50",
      file.status === 'error' && "bg-red-50",
      !file.status && "bg-gray-50"
    )}
  >
    <div className="flex items-center gap-2">
      {file.status === 'uploading' ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500" />
      ) : file.type?.startsWith('image/') ? (
        <Image className="w-3.5 h-3.5" />
      ) : file.type?.includes('pdf') ? (
        <FileText className="w-3.5 h-3.5" />
      ) : (
        <File className="w-3.5 h-3.5" />
      )}
      <span className="truncate max-w-[180px]">{file.name}</span>
    </div>
    <button
      type="button"
      onClick={() => onRemove(index)}
      className="ml-1 p-0.5 rounded-full hover:bg-gray-200/50"
    >
      <X className="w-3.5 h-3.5" />
    </button>
  </div>
);

export function QuickTaskModal({ isOpen, onClose, onSuccess, statuses, users, parentTaskId, projectId, companyId }: QuickTaskModalProps) {
  const navigate = useNavigate();
  
  // -------------------
  // Стани для файлів
  // -------------------
  const [files, setFiles] = useState<FileWithStatus[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // -------------------
  // Стани для календаря
  // -------------------
  const [dueDateOpen, setDueDateOpen] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);

  // -------------------
  // Стан форми / помилки
  // -------------------
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // -------------------
  // Стан завдання
  // -------------------
  const [responsible, setResponsible] = useState<string | null>(null);
  const [coworkers, setCoworkers] = useState<string[]>([]);
  const [selectedStatus, setSelectedStatus] = useState(statuses[0]?.id ?? '');
  const [selectedDate, setSelectedDate] = useState<string | null>(getDefaultDueDate());
  const [priority, setPriority] = useState(0);
  const [selectedProject, setSelectedProject] = useState<string | null>(projectId || null);
  const [title, setTitle] = useState('');

  // Якщо це сабтаск
  const isSubtask = !!parentTaskId;
  const [parentProject, setParentProject] = useState<{ id: string; name: string } | null>(null);

  // Користувачі / проекти (renamed state to avoid conflict with prop)
  const [fetchedUsers, setFetchedUsers] = useState<{ id: string; email: string }[]>(users || []);
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);

  // Dropdown
  const [dropdownsVisible, setDropdownsVisible] = useState({
    status: false,
    responsible: false,
    coworkers: false,
    project: false,
  });

  // Модалка AI
  const [showSubtaskModal, setShowSubtaskModal] = useState(false);

  // Editor content
  const [editorContent, setEditorContent] = useState('');
  const [isClosing, setIsClosing] = useState(false);

  // -------------------
  // Рефи / модалка
  // -------------------
  const modalRef = useRef<HTMLDivElement>(null);
  const statusButtonRef = useRef<HTMLButtonElement>(null);
  const statusMenuRef = useRef<HTMLDivElement>(null);
  const responsibleButtonRef = useRef<HTMLButtonElement>(null);
  const responsibleMenuRef = useRef<HTMLDivElement>(null);
  const coworkersButtonRef = useRef<HTMLButtonElement>(null);
  const coworkersMenuRef = useRef<HTMLDivElement>(null);
  const projectButtonRef = useRef<HTMLButtonElement>(null);
  const projectMenuRef = useRef<HTMLDivElement>(null);
  const calendarRef = useRef<HTMLDivElement>(null);

  // Додаємо новий стан для відстеження статусу завантаження
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');

  // -------------------
  // Закриття dropdown-меню при кліку поза ними
  // -------------------
  useEffect(() => {
    function handleDocumentClick(e: MouseEvent) {
      const target = e.target as Node;
      // Закриття статусу
      if (dropdownsVisible.status) {
        if (!statusButtonRef.current?.contains(target) && !statusMenuRef.current?.contains(target)) {
          setDropdownsVisible(prev => ({ ...prev, status: false }));
        }
      }
      // Відповідальний
      if (dropdownsVisible.responsible) {
        if (!responsibleButtonRef.current?.contains(target) && !responsibleMenuRef.current?.contains(target)) {
          setDropdownsVisible(prev => ({ ...prev, responsible: false }));
        }
      }
      // Коворкери
      if (dropdownsVisible.coworkers) {
        if (!coworkersButtonRef.current?.contains(target) && !coworkersMenuRef.current?.contains(target)) {
          setDropdownsVisible(prev => ({ ...prev, coworkers: false }));
        }
      }
      // Проект
      if (dropdownsVisible.project) {
        if (!projectButtonRef.current?.contains(target) && !projectMenuRef.current?.contains(target)) {
          setDropdownsVisible(prev => ({ ...prev, project: false }));
        }
      }
      // Закриття календаря
      if (dueDateOpen) {
        const datePickerContainer = document.getElementById('due-date-container');
        if (datePickerContainer && !datePickerContainer.contains(target)) {
          setDueDateOpen(false);
        }
      }
    }
    document.addEventListener('mousedown', handleDocumentClick, true);
    return () => {
      document.removeEventListener('mousedown', handleDocumentClick, true);
    };
  }, [dropdownsVisible, dueDateOpen]);

  // -------------------
  // React Hook Form
  // -------------------
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors }
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: '',
      description: '',
      status_id: statuses[0]?.id,
      due_date: getDefaultDueDate(),
    },
  });

  // -------------------
  // Tiptap Editor
  // -------------------
  const editor = useEditor({
    extensions: [StarterKit],
    content: '',
  });

  // -------------------
  // Сабміт створення задачі
  // -------------------
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length === 0) return;

    setIsUploading(true);
    setUploadProgress(0);
    setUploadStatus('uploading');

    try {
      const newFiles = selectedFiles.map(file => ({
        id: crypto.randomUUID(),
        name: file.name,
        size: file.size,
        type: file.type,
        file: file, // Зберігаємо оригінальний файл
        status: 'uploading' as const
      }));

      setFiles(prev => [...prev, ...newFiles]);

      // Імітуємо завантаження для UI
      let progress = 0;
      const interval = setInterval(() => {
        progress += 10;
        setUploadProgress(Math.min(progress, 100));
        if (progress >= 100) {
          clearInterval(interval);
          setUploadStatus('success');
          setFiles(prev => 
            prev.map(f => ({
              ...f,
              status: 'success' as const
            }))
          );
        }
      }, 500);

    } catch (error) {
      console.error('File preparation error:', error);
      setUploadStatus('error');
      setFiles(prev => 
        prev.map(f => ({
          ...f,
          status: 'error' as const
        }))
      );
    } finally {
      setTimeout(() => {
        setIsUploading(false);
      }, 5500);
    }
  };

  const handleFormSubmit = async (formData: FormData) => {
    if (isSubmitting) return;
    
    try {
      setIsSubmitting(true);
      setError(null);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No authenticated user');

      let taskStatusId = selectedStatus;

      // Якщо це сабтаск, отримуємо статус з батьківської задачі
      if (parentTaskId) {
        const { data: parentTask, error: parentError } = await supabase
          .from('tasks')
          .select('status_id')
          .eq('id', parentTaskId)
          .single();

        if (parentError) throw parentError;
        taskStatusId = parentTask.status_id;
      }

      const { data: maxPositionData } = await supabase
        .from('tasks')
        .select('position')
        .eq('status_id', taskStatusId)
        .order('position', { ascending: false })
        .limit(1);

      const taskPosition = (maxPositionData?.[0]?.position || 0) + 1000;

      const taskData = {
        title: formData.title,
        description: editor?.getHTML() || '',
        status_id: taskStatusId,
        due_date: selectedDate,
        responsible_id: responsible || null,
        project_id: projectId || selectedProject || null,
        priority: priority || 0,
        owner_id: user.id,
        company_id: companyId,
        parent_id: parentTaskId || null,
        position: taskPosition,
        is_subtask: Boolean(parentTaskId),
        coworkers: coworkers || []
      };

      const { data: newTask, error: createError } = await supabase
        .from('tasks')
        .insert([taskData])
        .select('*')
        .single();

      if (createError) throw createError;
      
      // Тепер завантажуємо файли, якщо вони є
      if (files.length > 0) {
        const uploadPromises = files.map(async (fileData) => {
          if (!fileData.file) {
            console.error('No file object found for:', fileData);
            return null;
          }

          const fileExt = fileData.name.split('.').pop();
          const sanitizedTaskId = newTask.id.replace(/[^a-zA-Z0-9]/g, '');
          const filePath = `${sanitizedTaskId}/${fileData.id}.${fileExt}`;

          try {
            // Завантажуємо файл
            const { error: uploadError } = await supabase.storage
              .from('task-attachments')
              .upload(filePath, fileData.file, {
                cacheControl: '3600',
                upsert: false
              });

            if (uploadError) throw uploadError;

            // Отримуємо публічне URL
            const { data: { publicUrl } } = supabase.storage
              .from('task-attachments')
              .getPublicUrl(filePath);

            return {
              id: fileData.id,
              name: fileData.name,
              size: fileData.size,
              type: fileData.type,
              path: filePath,
              url: publicUrl
            };
          } catch (error) {
            console.error('Error uploading file:', error);
            return null;
          }
        });

        const uploadedFiles = (await Promise.all(uploadPromises)).filter(Boolean);

        if (uploadedFiles.length > 0) {
          // Оновлюємо задачу з завантаженими файлами
          const { error: updateError } = await supabase
            .from('tasks')
            .update({ files: uploadedFiles })
            .eq('id', newTask.id);

          if (updateError) throw updateError;
        }
      }

      // If this is a subtask
      if (parentTaskId) {
        // First call onSuccess to update parent's subtask list
        if (onSuccess) {
          await onSuccess(newTask);
        }
        
        // Close modal
        onClose();
        
        // Navigate to parent task
        navigate(`/${newTask.company_id}/tasks/${parentTaskId}`, { replace: true });
      } else {
        // For regular tasks, just close and navigate
        onClose();
        navigate(`/${newTask.company_id}/tasks/${newTask.id}`, { replace: true });
      }

    } catch (err) {
      console.error('Error creating task:', err);
      setError(err instanceof Error ? err.message : 'Failed to create task');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Додайте обробник для кнопки Create Task
  const handleCreateTask = () => {
    const title = watch('title');
    if (!title) {
      setError('Title is required');
      return;
    }
    handleSubmit(handleFormSubmit)();
  };

  // Оновлений обробник клавіші Enter
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    // Перевіряємо чи активний елемент не є частиною едітора опису
    const isDescriptionActive = editor?.isFocused;
    
    // Перевіряємо чи активний елемент не є частиною календаря
    const isCalendarActive = calendarRef.current?.contains(document.activeElement);
    
    if (e.key === 'Enter' && !e.shiftKey && !dueDateOpen && !isCalendarActive && !isDescriptionActive) {
      e.preventDefault();
      handleCreateTask();
    }
  }, [handleCreateTask, dueDateOpen, editor]);

  // Оновлений глобальний обробник Enter
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const isDescriptionActive = editor?.isFocused;
      const isCalendarActive = calendarRef.current?.contains(document.activeElement);
      const isDatePickerOpen = dueDateOpen;
      
      if (isOpen && e.key === 'Enter' && !e.shiftKey && !isDatePickerOpen && !isCalendarActive && !isDescriptionActive) {
        e.preventDefault();
        handleCreateTask();
      }
    };
    document.addEventListener('keydown', handleGlobalKeyDown);
    return () => document.removeEventListener('keydown', handleGlobalKeyDown);
  }, [isOpen, handleCreateTask, dueDateOpen, editor]);

  // -------------------
  // Завантаження parentTask, проєктів
  // -------------------
  useEffect(() => {
    async function init() {
      if (parentTaskId) {
        const { data: parentTask } = await supabase
          .from('tasks')
          .select(`
            project_id,
            project:projects(id,name)
          `)
          .eq('id', parentTaskId)
          .single();
        if (parentTask?.project) {
          setParentProject(parentTask.project);
          setSelectedProject(parentTask.project.id);
        }
      }
      if (statuses.length > 0 && !selectedStatus) {
        setSelectedStatus(statuses[0].id);
        setValue('status_id', statuses[0].id);
      }
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) throw new Error('No authenticated user');

        const { data: profile } = await supabase
          .from('user_profiles')
          .select('current_company_id')
          .eq('user_id', session.user.id)
          .single();
        if (!profile?.current_company_id) throw new Error('No current company');

        // Список учасників
        const { data: members, error: membersError } = await supabase
          .from('company_members')
          .select(`
            user_id,
            user:user_profiles!inner(email, first_name, last_name)
          `)
          .eq('company_id', profile.current_company_id);
        if (membersError) throw membersError;
        const fetchedUsersData = members.map(member => ({
          id: member.user_id,
          email: member.user.email,
          first_name: member.user.first_name || '',
          last_name: member.user.last_name || ''
        }));
        setFetchedUsers(fetchedUsersData);

        // Якщо це не сабтаск — завантажуємо проєкти
        if (!parentTaskId) {
          const { data: projs, error: projectsError } = await supabase
            .from('projects')
            .select('id, name')
            .eq('company_id', profile.current_company_id)
            .order('name');
          if (projectsError) throw projectsError;
          setProjects(projs || []);
        }
      } catch (err) {
        console.error('Failed to load data:', err);
        setError('Failed to load data');
      }
    }
    init();
  }, [parentTaskId, statuses, selectedStatus, setValue]);

  // -------------------
  // Закриття dropdown поза модалкою
  // -------------------
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (!modalRef.current?.contains(e.target as Node)) {
        setDropdownsVisible({
          responsible: false,
          coworkers: false,
          project: false,
          status: false
        });
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // -------------------
  // Закриття по Escape
  // -------------------
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setDropdownsVisible({
          responsible: false,
          coworkers: false,
          project: false,
          status: false
        });
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  // -------------------
  // Обробники для файлів
  // -------------------
  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  // Add formatFileSize helper
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Add this function inside the QuickTaskModal component
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      // Only close if clicking the backdrop itself, not its children
      onClose();
    }
  };

  // Встановлюємо поточного користувача як відповідального при монтуванні
  useEffect(() => {
    const setCurrentUserAsResponsible = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setResponsible(user.id);
      }
    };
    setCurrentUserAsResponsible();
  }, []);

  if (!isOpen) return null;

  // -------------------
  // Рендер
  // -------------------
  return (
    <div 
      className={cn(
        "fixed inset-0 bg-black/20 backdrop-blur-sm z-50",
        "flex items-center justify-center p-4",
        "overflow-y-auto"
      )}
      onClick={handleBackdropClick}
    >
      <div 
        className={cn(
          "bg-white rounded-xl shadow-xl w-full max-w-2xl",
          "relative transform transition-all"
        )}
        ref={modalRef}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 bg-white rounded-t-xl border-b">
          <div className="p-4 border-b flex items-center">
            <div className="flex-1">
              <input
                required
                onKeyDown={handleKeyDown}
                {...register('title')}
                className={cn(
                  "w-full text-xl font-medium bg-transparent border-0 p-0 focus:ring-0 focus:outline-none placeholder:text-gray-400",
                  errors.title && "text-red-500 placeholder:text-red-300"
                )}
                placeholder="Task title"
                autoFocus
              />
            </div>
            <div className="ml-3">
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-500"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className={cn(
          "p-6",
          "max-h-[calc(90vh-8rem)]",
          "overflow-y-auto"
        )}>
          {/* Controls Grid */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            {/* Status */}
            <div>
              <span className="text-xs font-medium text-gray-500 block mb-1">Status</span>
              <div className="relative" ref={statusMenuRef}>
                <button
                  ref={statusButtonRef}
                  type="button"
                  onClick={() =>
                    setDropdownsVisible(prev => ({
                      ...prev,
                      status: !prev.status,
                      responsible: false,
                      coworkers: false,
                      project: false
                    }))
                  }
                  className="w-full flex items-center justify-between p-2 rounded-lg bg-gray-50 hover:bg-gray-100"
                >
                  <span className="flex items-center gap-2">
                    <span
                      className="w-3 h-3 rounded-full"
                      style={{
                        backgroundColor: statuses.find(s => s.id === selectedStatus)?.color || '#000'
                      }}
                    />
                    <span className="text-sm text-gray-700">
                      {statuses.find(s => s.id === selectedStatus)?.name || 'Select Status'}
                    </span>
                  </span>
                  <ChevronDown className="w-4 h-4 text-gray-500" />
                </button>
                {dropdownsVisible.status && (
                  <div className="absolute top-full left-0 mt-1 w-full bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-[9999]">
                    {statuses.map(status => (
                      <button
                        key={status.id}
                        type="button"
                        onClick={() => {
                          setSelectedStatus(status.id);
                          setValue('status_id', status.id, { shouldValidate: true });
                          setDropdownsVisible(prev => ({ ...prev, status: false }));
                        }}
                        className="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center gap-2"
                      >
                        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: status.color }} />
                        <span className="text-sm">{status.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Due Date */}
            <div>
              <span className="text-xs font-medium text-gray-500 block mb-1">Due Date</span>
              <DueDatePicker 
                selectedDate={selectedDate}
                onChange={(date) => {
                  setSelectedDate(date || '');
                  setValue('due_date', date);
                }}
                className="w-full p-2 rounded-lg bg-gray-50 hover:bg-gray-100"
              />
            </div>

            {/* Project */}
            {!parentTaskId && (
              <div>
                <span className="text-xs font-medium text-gray-500 block mb-1">Project</span>
                <div className="relative" ref={projectMenuRef}>
                  <button
                    ref={projectButtonRef}
                    type="button"
                    onClick={() =>
                      setDropdownsVisible(prev => ({
                        ...prev,
                        project: !prev.project,
                        responsible: false,
                        coworkers: false,
                        status: false
                      }))
                    }
                    className="w-full flex items-center justify-between p-2 rounded-lg bg-gray-50 hover:bg-gray-100"
                  >
                    <div className="flex items-center gap-2">
                      <FolderKanban className="w-4 h-4 text-gray-500" />
                      <span className="text-sm text-gray-700">
                        {selectedProject
                          ? projects.find(p => p.id === selectedProject)?.name
                          : "Select Project"}
                      </span>
                    </div>
                    <ChevronDown className="w-4 h-4 text-gray-500" />
                  </button>
                  {dropdownsVisible.project && (
                    <div className="absolute top-full left-0 mt-1 w-full bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-[9999]">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedProject(null);
                          setDropdownsVisible(prev => ({ ...prev, project: false }));
                        }}
                        className="w-full px-4 py-2 text-sm text-left hover:bg-gray-50 flex items-center gap-2"
                      >
                        <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-gray-600">
                          <X className="w-3 h-3" />
                        </div>
                        <span>No Project</span>
                      </button>
                      {projects.map(project => (
                        <button
                          key={project.id}
                          type="button"
                          onClick={() => {
                            setSelectedProject(project.id);
                            setDropdownsVisible(prev => ({ ...prev, project: false }));
                          }}
                          className={cn(
                            "w-full px-4 py-2 text-sm text-left hover:bg-gray-50 flex items-center gap-2",
                            selectedProject === project.id && "bg-indigo-50 text-indigo-700"
                          )}
                        >
                          <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700">
                            {project.name.charAt(0).toUpperCase()}
                          </div>
                          <span>{project.name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Responsible */}
            <div>
              <span className="text-xs font-medium text-gray-500 block mb-1">Responsible</span>
              <div className="relative" ref={responsibleMenuRef}>
                <button
                  ref={responsibleButtonRef}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDropdownsVisible(prev => ({
                      ...prev,
                      responsible: !prev.responsible,
                      coworkers: false,
                      project: false,
                      status: false
                    }));
                  }}
                  className="w-full flex items-center justify-between p-2 rounded-lg bg-gray-50 hover:bg-gray-100"
                >
                  {responsible ? (
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center text-sm font-medium text-emerald-700">
                        {fetchedUsers.find(u => u.id === responsible)?.email.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-sm text-gray-700">
                        {userService.formatUserName(fetchedUsers.find(u => u.id === responsible))}
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-gray-500" />
                      <span className="text-sm text-gray-700">Select Responsible</span>
                    </div>
                  )}
                  <ChevronDown className="w-4 h-4 text-gray-500" />
                </button>
                {dropdownsVisible.responsible && (
                  <div className="absolute top-full left-0 mt-1 w-64 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-[9999] max-h-[240px] overflow-y-auto">
                    {fetchedUsers.map(user => (
                      <button
                        key={user.id}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setResponsible(user.id);
                          setDropdownsVisible(prev => ({ ...prev, responsible: false }));
                        }}
                        className={cn(
                          "w-full px-4 py-2 text-sm text-left hover:bg-gray-50 flex items-center space-x-2",
                          responsible === user.id && "bg-emerald-50 text-emerald-700 font-medium"
                        )}
                      >
                        <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center text-sm font-medium text-emerald-700">
                          {(user.first_name || user.email).charAt(0).toUpperCase()}
                        </div>
                        <span>{userService.formatUserName(user)}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Co-workers */}
            <div>
              <span className="text-xs font-medium text-gray-500 block mb-1">Co-workers</span>
              <div className="relative" ref={coworkersMenuRef}>
                <button
                  ref={coworkersButtonRef}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDropdownsVisible(prev => ({
                      ...prev,
                      coworkers: !prev.coworkers,
                      responsible: false,
                      project: false,
                      status: false
                    }));
                  }}
                  className="w-full flex items-center justify-between p-2 rounded-lg bg-gray-50 hover:bg-gray-100"
                >
                  {coworkers.length > 0 ? (
                    <div className="flex items-center gap-1">
                      {coworkers.slice(0, 3).map(workerId => (
                        <div
                          key={workerId}
                          className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center text-sm font-medium text-indigo-700"
                          title={userService.formatUserName(fetchedUsers.find(u => u.id === workerId))}
                        >
                          {fetchedUsers.find(u => u.id === workerId)?.email.charAt(0).toUpperCase()}
                        </div>
                      ))}
                      {coworkers.length > 3 && (
                        <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-sm font-medium text-gray-600">
                          +{coworkers.length - 3}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-gray-500" />
                      <span className="text-sm text-gray-700">Select Co-workers</span>
                    </div>
                  )}
                  <ChevronDown className="w-4 h-4 text-gray-500" />
                </button>
                {dropdownsVisible.coworkers && (
                  <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 w-64 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-[9999] max-h-[240px] overflow-y-auto">
                    {fetchedUsers.map(user => (
                      <button
                        key={user.id}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (user.id === responsible) return;
                          if (coworkers.includes(user.id)) {
                            setCoworkers(prev => prev.filter(id => id !== user.id));
                          } else {
                            setCoworkers(prev => [...prev, user.id]);
                          }
                        }}
                        className={cn(
                          "w-full px-4 py-2 text-sm text-left hover:bg-gray-50 flex items-center justify-between",
                          coworkers.includes(user.id) && "bg-indigo-50 text-indigo-700",
                          user.id === responsible && "opacity-50 cursor-not-allowed"
                        )}
                      >
                        <div className="flex items-center">
                          <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center text-sm font-medium text-indigo-700">
                            {(user.first_name || user.email).charAt(0).toUpperCase()}
                          </div>
                          <span className="ml-2">{userService.formatUserName(user)}</span>
                        </div>
                        {coworkers.includes(user.id) && (
                          <div className="w-4 h-4 rounded-full bg-indigo-500 flex items-center justify-center">
                            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Priority */}
            <div>
              <span className="text-xs font-medium text-gray-500 block mb-1">Priority</span>
              <div className="flex items-center gap-1">
                {[0, 1, 2, 3].map(level => (
                  <button
                    key={level}
                    type="button"
                    onClick={() => setPriority(level)}
                    className={cn(
                      "p-1 rounded transition-all",
                      level === 0
                        ? priority === 0
                          ? "bg-gray-100 text-gray-600"
                          : "text-gray-400 hover:bg-gray-50"
                        : priority >= level
                          ? "bg-amber-50 text-amber-600"
                          : "text-gray-400 hover:bg-gray-50"
                    )}
                  >
                    {level === 0 ? (
                      <span className="text-xs">None</span>
                    ) : (
                      <Flame className={cn("w-3.5 h-3.5", priority >= level && "fill-current")} />
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Description with RichTextToolbar */}
          <div className="mb-6">
            <style>{styles}</style>
            <div className="relative">
              {/* Files Preview */}
              {files.length > 0 && (
                <div className="mb-2">
                  <div className="flex flex-wrap gap-2">
                    {files.map((file, index) => (
                      <FilePreview 
                        key={index}
                        file={file}
                        onRemove={removeFile}
                        index={index}
                      />
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <RichTextToolbar editor={editor} />
                  <label className="flex items-center gap-1 px-2 py-1 cursor-pointer text-gray-500 hover:text-gray-700 text-sm">
                    <input
                      type="file"
                      multiple
                      onChange={handleFileChange}
                      ref={fileInputRef}
                      className="hidden"
                      accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
                    />
                    <Paperclip className="w-4 h-4" />
                    <span>Add Files</span>
                  </label>
                </div>
              </div>

              <div 
                className={cn(
                  "min-h-[300px] prose prose-sm max-w-none",
                  "border border-transparent focus-within:border-transparent",
                  "rounded-lg relative cursor-text"
                )}
                onClick={() => editor?.commands.focus()}
              >
                {/* Placeholder для текста */}
                {(!editor?.getText() || editor?.getText().length === 0) && (
                  <div className="absolute top-[1.125rem] left-4 pointer-events-none text-gray-400">
                    Type your description here...
                  </div>
                )}
                <EditorContent 
                  editor={editor} 
                  className={cn(
                    "focus:outline-none min-h-[300px]",
                    "text-[15px] leading-relaxed text-gray-700",
                    "[&_*]:outline-none [&_p]:m-0",
                    "selection:bg-gray-100",
                    "pt-[1.125rem] px-4",
                    "font-inter",
                    "[&_p]:text-[15px] [&_p]:leading-[1.6]",
                    "[&_p]:font-normal [&_p]:text-gray-700",
                  )}
                />
              </div>

              {/* Upload Progress with new animation */}
              {isUploading && (
                <div className="mt-2">
                  <UploadingAnimation />
                </div>
              )}

              {/* Success/Error Messages */}
              {uploadStatus === 'success' && !isUploading && (
                <div className="mt-1">
                  <p className="text-xs text-emerald-600 flex items-center">
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    Files uploaded successfully
                  </p>
                </div>
              )}

              {uploadStatus === 'error' && !isUploading && (
                <div className="mt-1">
                  <p className="text-xs text-red-600 flex items-center">
                    <AlertCircle className="w-3 h-3 mr-1" />
                    Failed to upload files
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="px-4 py-2 bg-red-50 text-red-600 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <p className="text-sm">{error}</p>
            </div>
          )}
        </div>

        {/* Footer with buttons */}
        <div className="sticky bottom-0 z-10 bg-white py-3 px-4">
          <div className="flex items-center justify-end">
            <button
              type="button"
              onClick={() => handleFormSubmit(watch())}
              disabled={isSubmitting || !watch('title')}
              className={cn(
                "px-4 py-1.5 text-sm font-medium rounded-lg text-white",
                "bg-indigo-600 hover:bg-indigo-500",
                "disabled:opacity-50 disabled:cursor-not-allowed",
                "flex items-center gap-2"
              )}
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {isSubmitting ? 'Creating...' : isSubtask ? 'Create Subtask' : 'Create Task'}
            </button>
          </div>
        </div>
      </div>

      {/* AI Subtask Modal */}
      {showSubtaskModal && (
        <SubtaskSuggestionModal
          isOpen={showSubtaskModal}
          onClose={() => setShowSubtaskModal(false)}
          onSuccess={onSuccess}
          task={{
            title: watch('title'),
            description: editor?.getHTML() || null,
          }}
          statuses={statuses}
          users={users}
          parentTaskId={parentTaskId}
          companyId={companyId}
        />
      )}
    </div>
  );
}
export default QuickTaskModal;