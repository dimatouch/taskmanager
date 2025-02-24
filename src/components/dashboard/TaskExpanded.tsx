import { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { Loader2, X, Calendar, User, ChevronDown, Flame, FolderKanban } from 'lucide-react';
import { userService } from '../../services/userService';
import { supabase } from '../../lib/supabase';
import { taskActivityService } from '../../services/taskActivityService';
import { cn } from '../../lib/utils';
import { DatePicker } from '../ui/DatePicker';
import type { TaskStatus } from './types';

const schema = z.object({
  title: z.string().min(1, 'Title is required').max(100, 'Title is too long'),
  description: z.string().optional(),
  due_date: z.string().optional().nullable(),
  status_id: z.string().uuid('Invalid status'),
});

type FormData = z.infer<typeof schema>;

interface TaskExpandedProps {
  isOpen: boolean;
  onClose: (toQuickMode?: boolean, formData?: any) => void;
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

export function TaskExpanded({ isOpen, onClose, onSuccess, statuses, users: initialUsers, parentTaskId, initialFormState }: TaskExpandedProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [responsible, setResponsible] = useState<string | null>(initialFormState?.responsible ?? null);
  const [coworkers, setCoworkers] = useState<string[]>(initialFormState?.coworkers ?? []);
  const [selectedStatus, setSelectedStatus] = useState<string>(initialFormState?.status_id ?? statuses[0]?.id ?? '');
  const [selectedDate, setSelectedDate] = useState(initialFormState?.due_date ?? '');
  const [priority, setPriority] = useState(initialFormState?.priority ?? 0);
  const [selectedProject, setSelectedProject] = useState<string | null>(initialFormState?.project_id ?? null);
  const [users, setUsers] = useState<{ id: string; email: string }[]>(initialUsers || []);
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const isSubtask = !!parentTaskId;
  const [dropdownsVisible, setDropdownsVisible] = useState({
    responsible: false,
    coworkers: false,
    project: false
  });
  const [error, setError] = useState<string | null>(null);
  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);
  const [isBulletList, setIsBulletList] = useState(false);
  const [isOrderedList, setIsOrderedList] = useState(false);
  const [isTaskList, setIsTaskList] = useState(false);

  const modalRef = useRef<HTMLDivElement>(null);
  const coworkersButtonRef = useRef<HTMLButtonElement>(null);
  const coworkersMenuRef = useRef<HTMLDivElement>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors }
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: initialFormState?.title ?? '',
      description: initialFormState?.description ?? '',
      status_id: initialFormState?.status_id ?? statuses[0]?.id,
      due_date: initialFormState?.due_date ?? null,
    },
  });

  const editor = useEditor({
    extensions: [
      StarterKit,
      TaskList.configure({ itemTypeName: 'taskItem', HTMLAttributes: { class: 'task-list-container' } }),
      TaskItem.configure({ nested: true, onReadOnlyChecked: false, HTMLAttributes: { class: 'task-item' } }),
    ],
    content: initialFormState?.description || '',
    autofocus: 'end',
    editorProps: {
      attributes: { class: 'prose prose-sm focus:outline-none min-h-[120px] px-4 py-3' },
    },
    onUpdate: ({ editor }) => {
      const content = editor.getHTML();
      // Update toolbar states
      setIsBold(editor.isActive('bold'));
      setIsItalic(editor.isActive('italic'));
      setIsBulletList(editor.isActive('bulletList'));
      setIsOrderedList(editor.isActive('orderedList'));
      setIsTaskList(editor.isActive('taskList'));
      setValue('description', content);
    },
  });

  useEffect(() => {
    if (initialFormState?.description && editor && editor.getHTML() !== initialFormState.description) {
      editor.commands.setContent(initialFormState.description);
      setValue('description', initialFormState.description);
    }
  }, [initialFormState?.description, editor, setValue]);

  useEffect(() => {
    async function init() {
      if (statuses.length > 0 && !selectedStatus) {
        setSelectedStatus(statuses[0].id);
        setValue('status_id', statuses[0].id);
      }

      try {
        const fetchedUsers = await userService.getUsers();
        setUsers(fetchedUsers);
        
        const { data: projects, error: projectsError } = await supabase
          .from('projects')
          .select('id, name')
          .order('name');
        
        if (projectsError) throw projectsError;
        setProjects(projects || []);
        
      } catch (err) {
        console.error('Failed to load users:', err);
        setError('Failed to load users');
      }
    }
    
    init();
  }, [statuses, selectedStatus, setValue]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownsVisible.coworkers &&
          !coworkersButtonRef.current?.contains(e.target as Node) &&
          !coworkersMenuRef.current?.contains(e.target as Node)) {
        setDropdownsVisible(prev => ({ ...prev, coworkers: false }));
      }
      
      if (!modalRef.current?.contains(e.target as Node)) {
        setDropdownsVisible({ responsible: false, coworkers: false, project: false });
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!isOpen) return null;

  const onSubmit = async (data: FormData) => {
    try {
      setIsSubmitting(true);
      setError(null);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('No authenticated user');
      }
      
      const { data: task, error: taskError } = await supabase
        .from('tasks')
        .insert({
          title: data.title,
          description: editor?.getHTML() || null,
          due_date: data.due_date || null,
          project_id: selectedProject,
          priority: priority,
          status_id: selectedStatus,
          position: 0,
          owner_id: user.id,
          parent_id: parentTaskId || null,
          is_subtask: !!parentTaskId,
          responsible_id: responsible,
          coworkers: coworkers,
        })
        .select()
        .single();

      if (taskError) throw taskError;
      if (!task) throw new Error('Failed to create task');

      await taskActivityService.logActivity({
        taskId: task.id,
        field: 'status',
        newValue: selectedStatus,
        type: 'create'
      });

      onSuccess();
      onClose();

    } catch (err) {
      console.error('Failed to create task:', err instanceof Error ? err.message : err);
      setError(err instanceof Error ? err.message : 'Failed to create task');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-[2px] flex items-start justify-center p-4 z-[60] animate-in fade-in duration-200">
      <div
        ref={modalRef}
        className="w-full max-w-6xl bg-white rounded-xl shadow-xl transition-all duration-300 ease-in-out relative mt-8 h-[90vh] flex flex-col">
        {isSubtask && (
          <div className="absolute -top-6 left-1/2 -translate-x-1/2 px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-xs font-medium shadow-sm border border-indigo-200">
            Creating Subtask
          </div>
        )}

        <div className="p-4 flex items-center border-b">
          <div className="flex-1">
            <input
              required
              {...register('title')}
              className={cn(
                "flex-1 text-xl font-medium bg-transparent border-0 p-0 focus:ring-0 focus:outline-none placeholder:text-gray-400 text-center w-full max-w-2xl mx-auto",
                errors.title && "text-red-500 placeholder:text-red-300"
              )}
              placeholder={isSubtask ? "Subtask title" : "Task title"}
              autoFocus
            />
            {errors.title && (
              <p className="mt-1 text-sm text-red-500 text-center">{errors.title.message}</p>
            )}
            {error && (
              <p className="mt-1 text-sm text-red-500 text-center">{error}</p>
            )}
          </div>
          <div className="flex items-center gap-2 absolute right-4 top-4">
            <button
              type="button"
              onClick={() => {
                onClose(true, {
                  title: watch('title'),
                  description: editor?.getHTML() || '',
                  status_id: selectedStatus,
                  due_date: selectedDate,
                  project_id: selectedProject,
                  priority,
                  responsible,
                  coworkers,
                  is_subtask: isSubtask
                });
              }}
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-500 transition-colors"
              title="Switch to Quick Mode"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 3h18v18H3zM8 8h8v8H8z" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => onClose(false)}
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-500"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          <div className="flex flex-col w-[70%] relative">
            <div className="flex-1 overflow-y-auto p-6">
              {/* Rich Text Toolbar */}
              <div className="flex items-center gap-1 p-1 bg-white border rounded-lg mb-4 sticky top-0 z-10">
                <button
                  type="button"
                  onClick={() => editor?.chain().focus().toggleBold().run()}
                  className={cn(
                    "p-1.5 rounded hover:bg-gray-100 transition-colors",
                    isBold && "bg-gray-100 text-indigo-600"
                  )}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 4h8a4 4 0 014 4 4 4 0 01-4 4H6z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 12h9a4 4 0 014 4 4 4 0 01-4 4H6z" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => editor?.chain().focus().toggleItalic().run()}
                  className={cn(
                    "p-1.5 rounded hover:bg-gray-100 transition-colors",
                    isItalic && "bg-gray-100 text-indigo-600"
                  )}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                  </svg>
                </button>
                <div className="w-px h-4 bg-gray-200 mx-1" />
                <button
                  type="button"
                  onClick={() => editor?.chain().focus().toggleBulletList().run()}
                  className={cn(
                    "p-1.5 rounded hover:bg-gray-100 transition-colors",
                    isBulletList && "bg-gray-100 text-indigo-600"
                  )}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => editor?.chain().focus().toggleOrderedList().run()}
                  className={cn(
                    "p-1.5 rounded hover:bg-gray-100 transition-colors",
                    isOrderedList && "bg-gray-100 text-indigo-600"
                  )}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h12M7 12h12M7 17h12M3 7h.01M3 12h.01M3 17h.01" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => editor?.chain().focus().toggleTaskList().run()}
                  className={cn(
                    "p-1.5 rounded hover:bg-gray-100 transition-colors",
                    isTaskList && "bg-gray-100 text-indigo-600"
                  )}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </button>
              </div>

              <EditorContent 
                editor={editor} 
                className="prose prose-sm min-h-[120px] focus:outline-none p-4 w-full max-w-none bg-white rounded-lg border border-gray-200 shadow-sm" 
              />
            </div>
          </div>
          <div className="w-[30%] border-l bg-gray-50/50 p-6 space-y-6">
            <div className="flex items-center gap-1.5 justify-between">
              {statuses.map((status) => (
                <button
                  key={status.id}
                  type="button"
                  onClick={() => {
                    setSelectedStatus(status.id);
                    setValue('status_id', status.id, { shouldValidate: true });
                  }}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap flex-1",
                    selectedStatus === status.id
                      ? "shadow-lg scale-105 opacity-100 transform-gpu font-semibold"
                      : "hover:shadow-md hover:opacity-90 hover:scale-102 transform-gpu"
                  )}
                  style={{
                    backgroundColor: selectedStatus === status.id ? status.color : `${status.color}20`,
                    color: selectedStatus === status.id ? 'white' : status.color,
                    textShadow: selectedStatus === status.id ? '0 1px 2px rgba(0,0,0,0.2)' : 'none',
                  }}
                >
                  {status.name}
                </button>
              ))}
            </div>

            <div>
              <span className="text-xs font-medium text-gray-500 block mb-2">Project</span>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setDropdownsVisible(prev => ({
                      ...prev,
                      project: !prev.project,
                      responsible: false,
                      coworkers: false
                    }));
                  }}
                  className={cn(
                    "w-full flex items-center p-1 rounded-full transition-all duration-200",
                    selectedProject
                      ? "bg-indigo-100 text-indigo-700 ring-2 ring-indigo-200 ring-offset-1 hover:ring-indigo-300"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  )}
                >
                  <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center">
                    {selectedProject ? (
                      <div className="w-full h-full rounded-full flex items-center justify-center text-sm font-medium">
                        {projects.find(p => p.id === selectedProject)?.name.charAt(0).toUpperCase()}
                      </div>
                    ) : (
                      <FolderKanban className="w-4 h-4" />
                    )}
                  </div>
                  <div className="ml-2 text-sm font-medium text-gray-700">
                    {selectedProject
                      ? projects.find(p => p.id === selectedProject)?.name
                      : 'Select Project'
                    }
                  </div>
                  <ChevronDown className="w-4 h-4 ml-1.5" />
                </button>

                {dropdownsVisible.project && (
                  <div
                    className="absolute top-full left-0 mt-1 w-64 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedProject(null);
                        setDropdownsVisible(prev => ({ ...prev, project: false }));
                      }}
                      className={cn(
                        "w-full px-4 py-2 text-sm text-left hover:bg-gray-50 flex items-center",
                        !selectedProject && "bg-gray-50 text-gray-700 font-medium"
                      )}
                    >
                      <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-gray-600">
                        <X className="w-3 h-3" />
                      </div>
                      <span className="ml-2">No Project</span>
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
                          "w-full px-4 py-2 text-sm text-left hover:bg-gray-50 flex items-center",
                          selectedProject === project.id && "bg-indigo-50 text-indigo-700 font-medium"
                        )}
                      >
                        <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700">
                          {project.name.charAt(0).toUpperCase()}
                        </div>
                        <span className="ml-2">{project.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div>
              <span className="text-xs font-medium text-gray-500 block mb-2">Due Date</span>
              <DatePicker
                value={selectedDate}
                onChange={date => {
                  setSelectedDate(date);
                  setValue('due_date', date);
                }}
                showTime={true}
              />
            </div>

            <div className="space-y-2">
              <div className="grid grid-cols-3 gap-4 mb-2">
                <span className="text-xs text-gray-500 text-center">Responsible</span>
                <span className="text-xs text-gray-500 text-center">Co-workers</span>
                <span className="text-xs text-gray-500 text-center">Priority</span>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="flex items-center justify-center w-full">
                  <div className="relative">
                    <button
                      ref={modalRef}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDropdownsVisible(prev => ({
                          responsible: !prev.responsible,
                          coworkers: false,
                          project: false
                        }));
                      }}
                      className={cn(
                        "flex items-center p-1 rounded-full",
                        responsible
                          ? "bg-emerald-100 text-emerald-700 ring-2 ring-emerald-200 ring-offset-1 hover:ring-emerald-300"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      )}
                    >
                      <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center">
                        {responsible ? (
                          <span className="text-sm font-medium">
                            {users.find(u => u.id === responsible)?.email.charAt(0).toUpperCase()}
                          </span>
                        ) : (
                          <User className="w-4 h-4" />
                        )}
                      </div>
                      <ChevronDown className="w-4 h-4 ml-1.5" />
                    </button>

                    <div
                      id="responsible-menu"
                      className={cn(
                        "absolute top-full left-1/2 -translate-x-1/2 mt-1 w-64 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-[70] max-h-[240px] overflow-y-auto",
                        !dropdownsVisible.responsible && "hidden"
                      )}
                    >
                      {users.map(user => (
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
                  </div>
                </div>

                <div className="flex items-center gap-2 justify-center">
                  <div className="relative">
                    <div className="flex flex-wrap gap-1 mb-2">
                      {coworkers.map((userId) => (
                        <button
                          key={userId}
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setCoworkers(prev => prev.filter(id => id !== userId));
                          }}
                          className="flex items-center p-1 rounded-full bg-indigo-100 text-indigo-700 ring-2 ring-indigo-200 ring-offset-1 hover:ring-indigo-300"
                        >
                          <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center">
                            <span className="text-sm font-medium">
                              {users.find(u => u.id === userId)?.email.charAt(0).toUpperCase()}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>

                    <button
                      ref={coworkersButtonRef}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDropdownsVisible(prev => ({
                          responsible: false,
                          coworkers: !prev.coworkers,
                          project: false
                        }));
                      }}
                      className="flex items-center p-1 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200"
                    >
                      <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center">
                        <User className="w-4 h-4" />
                      </div>
                      <ChevronDown className="w-4 h-4 ml-1.5" />
                    </button>

                    <div
                      id="coworker-menu"
                      ref={coworkersMenuRef}
                      className={cn("absolute bottom-full right-0 mb-1 w-64 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-[70] max-h-[240px] overflow-y-auto",
                        !dropdownsVisible.coworkers && "hidden")}
                    >
                      {users.map(user => (
                        <button
                          key={user.id}
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            if (user.id === responsible) return;
                            if (coworkers.includes(user.id)) { 
                              setCoworkers(prev => prev.filter(id => id !== user.id));
                            } else {
                              setCoworkers(prev => [...prev, user.id]);
                            }
                          }}
                          className={cn(
                            "w-full px-4 py-2 text-sm text-left hover:bg-gray-50 flex items-center",
                            coworkers.includes(user.id) && "bg-indigo-50 text-indigo-700 font-medium",
                            user.id === responsible && "opacity-50 cursor-not-allowed",
                            "justify-between"
                          )}
                        >
                          <div className="flex items-center flex-1">
                            <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center text-sm font-medium text-indigo-700">
                              {(user.first_name || user.email).charAt(0).toUpperCase()}
                            </div>
                            <span className="text-sm mx-2 truncate">{userService.formatUserName(user)}</span>
                          </div>
                          <div className={cn(
                            "w-4 h-4 rounded border transition-colors",
                            coworkers.includes(user.id)
                              ? "bg-indigo-500 border-indigo-500"
                              : "border-gray-300",
                            user.id === responsible && "opacity-50"
                          )}>
                            {coworkers.includes(user.id) && (
                              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1 justify-center">
                  {[0, 1, 2, 3].map((level) => (
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
                        <Flame className={cn(
                          "w-3.5 h-3.5",
                          priority >= level && "fill-current"
                        )} />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 bg-gray-50 border-t flex items-center justify-end">
          <button
            onClick={handleSubmit(onSubmit)} 
            disabled={isSubmitting || !watch('title')}
            className={cn(
              "px-6 py-2 text-sm font-medium rounded-lg text-white",
              "bg-indigo-600 hover:bg-indigo-500",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              "flex items-center"
            )}
          >
            {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {parentTaskId ? 'Create Subtask' : 'Create Task'}
          </button>
        </div>
      </div>
    </div>
  );
}