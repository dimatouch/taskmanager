import { useState, useEffect, useCallback, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, User, ChevronDown, ClipboardList, X, Flame } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { cn } from '../../lib/utils';
import { ProjectCreateButton } from '../projects/ProjectCreateButton';
import { Database } from '../../types/supabase';
import { DatePicker } from '../ui/DatePicker';

type TaskStatus = Database['public']['Tables']['task_statuses']['Row'];
type Project = Database['public']['Tables']['projects']['Row'];

const schema = z.object({
  title: z.string().min(1, 'Title is required').max(100, 'Title is too long'),
  description: z.string().optional(),
  due_date: z.string().optional().nullable(),
  status_id: z.string().uuid('Invalid status'),
  project_id: z.string().uuid('Invalid project').optional().nullable()
});

type FormData = z.infer<typeof schema>;

interface TaskFormProps {
  statuses: TaskStatus[];
  onSuccess: () => void;
  onCancel: () => void;
  initialTitle?: string;
  hideHeader?: boolean;
}

export function TaskForm({ statuses, onSuccess, onCancel, initialTitle = '', hideHeader = false }: TaskFormProps) {
  const {
    register,
    handleSubmit,
    getValues,
    setValue,
    formState: { errors }
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: initialTitle,
      status_id: statuses[0]?.id,
    },
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [users, setUsers] = useState<{ id: string; email: string }[]>([]);
  const [responsible, setResponsible] = useState<string | null>(null);
  const [coworkers, setCoworkers] = useState<string[]>([]);
  const [selectedStatus, setSelectedStatus] = useState(statuses[0]?.id);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [priority, setPriority] = useState(0);

  // Мемоізуємо функції для кращої продуктивності
  const handleProjectSelect = useCallback((projectId: string) => {
    const menu = document.getElementById('project-menu');
    const overlay = document.getElementById('dropdown-overlay');
    if (menu) menu.classList.add('hidden');
    overlay?.classList.add('hidden');
    setSelectedProjectId(projectId);
  }, []);

  const handleResponsibleSelect = useCallback((userId: string) => {
    setResponsible(userId);
    const menu = document.getElementById('responsible-menu');
    if (menu) menu.classList.add('hidden');
  }, []);

  const handleCoworkerSelect = useCallback((userId: string) => {
    const menu = document.getElementById('coworker-menu');
    if (userId === responsible) return;
    
    setCoworkers(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
    if (menu) menu.classList.add('hidden');
  }, [responsible]);

  // Мемоізуємо вибраний проект
  const selectedProject = useMemo(() => 
    projects.find(p => p.id === selectedProjectId),
    [projects, selectedProjectId]
  );

  // Синхронізуємо локальний стан з формою перед сабмітом
  useEffect(() => {
    setValue('project_id', selectedProjectId);
  }, [selectedProjectId, setValue]);

  useEffect(() => {
    setValue('due_date', selectedDate);
  }, [selectedDate, setValue]);

  const editor = useEditor({
    extensions: [
      StarterKit,
      TaskList.configure({ itemTypeName: 'taskItem', HTMLAttributes: { class: 'task-list-container' } }),
      TaskItem.configure({ nested: true, onReadOnlyChecked: false, HTMLAttributes: { class: 'task-item' } }),
    ],
    content: '',
    editorProps: {
      attributes: { class: 'prose prose-sm focus:outline-none min-h-[120px] px-4 py-3' },
    },
    onUpdate: ({ editor }) => {
      register('description').onChange({ target: { value: editor.getHTML() } });
    },
  });

  useEffect(() => {
    fetchProjects();
    fetchUsers();
  }, []);

  async function fetchUsers() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUsers([
          { id: user.id, email: user.email || 'Me' },
          { id: '00000000-0000-0000-0000-000000000001', email: 'max@example.com' },
          { id: '00000000-0000-0000-0000-000000000002', email: 'polya@example.com' },
          { id: '00000000-0000-0000-0000-000000000003', email: 'dima@example.com' },
        ]);
      }
    } catch (err) {
      console.error('Failed to fetch users:', err);
    }
  }

  async function fetchProjects() {
    const { data } = await supabase.from('projects').select('*');
    if (data) setProjects(data);
  }

  const onSubmit = async (data: FormData) => {
    try {
      setIsSubmitting(true);
      
      // Create the task
      const { data: task, error: taskError } = await supabase.from('tasks').insert({
        title: data.title,
        description: data.description || null,
        due_date: data.due_date || null,
        project_id: data.project_id || null,
        status_id: selectedStatus,
        priority: priority,
        position: 0,
        owner_id: (await supabase.auth.getUser()).data.user!.id,
      }).select().single();

      if (taskError) throw taskError;

      // Add assignees
      if (responsible || coworkers.length > 0) {
        const assignees = [responsible, ...coworkers].filter(Boolean) as string[];
        const { error: assigneesError } = await supabase.from('task_assignees').insert(
          assignees.map(userId => ({
            task_id: task.id,
            user_id: userId
          }))
        );

        if (assigneesError) throw assigneesError;
      }

      onSuccess();
    } catch (err) {
      console.error('Failed to create task:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col h-full">
      {!hideHeader && <div className="p-4 border-b flex items-center">
        <div className="flex-1">
        <input
          autoFocus
          {...register('title')}
          className="text-xl font-medium bg-transparent border-0 focus:ring-0 p-0 focus:outline-none w-full break-words whitespace-pre-wrap leading-relaxed text-center"
          placeholder="Task title"
          style={{ wordBreak: 'break-word', width: '100%', maxWidth: '800px' }}
        />
        </div>
        <div className="flex items-center gap-2 ml-3">
          <button
            type="button"
            onClick={onCancel}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-500"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>}

      <div className="flex flex-1 overflow-hidden">
        <div className="flex flex-col bg-white transition-all duration-300 w-2/3 max-h-[80vh] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent">
          <div className="p-6 bg-gradient-to-br from-white to-gray-50/80 border-b">
            <div className="relative">
              <div className="sticky top-0 bg-white z-20 pb-2 border-b mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                  <div className="w-5 h-5 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 mr-2">
                    <ClipboardList className="w-3 h-3" />
                  </div>
                  Description
                </label>
                <div className="toolbar flex items-center gap-2 mb-2 p-1 bg-gray-50 rounded-lg border border-gray-200">
                  <button
                    type="button"
                    onClick={() => editor?.chain().focus().toggleBold().run()}
                    className={cn(
                      "p-1.5 rounded hover:bg-white hover:shadow-sm transition-all text-gray-600 hover:text-gray-900",
                      editor?.isActive('bold') && 'bg-white shadow-sm text-indigo-600'
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
                      "p-1.5 rounded hover:bg-white hover:shadow-sm transition-all text-gray-600 hover:text-gray-900",
                      editor?.isActive('italic') && 'bg-white shadow-sm text-indigo-600'
                    )}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => editor?.chain().focus().toggleBulletList().run()}
                    className={cn(
                      "p-1.5 rounded hover:bg-white hover:shadow-sm transition-all text-gray-600 hover:text-gray-900",
                      editor?.isActive('bulletList') && 'bg-white shadow-sm text-indigo-600'
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
                      "p-1.5 rounded hover:bg-white hover:shadow-sm transition-all text-gray-600 hover:text-gray-900",
                      editor?.isActive('orderedList') && 'bg-white shadow-sm text-indigo-600'
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
                      "p-1.5 rounded hover:bg-white hover:shadow-sm transition-all text-gray-600 hover:text-gray-900",
                      editor?.isActive('taskList') && 'bg-white shadow-sm text-indigo-600'
                    )}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                  </button>
                </div>
              </div>

              <EditorContent
                editor={editor}
                className={cn(
                  "w-full text-sm bg-white border border-gray-200 rounded-lg focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500",
                  "leading-relaxed shadow-md p-4 min-h-[120px] prose prose-sm max-w-none",
                  "prose-headings:font-semibold prose-h1:text-2xl prose-h2:text-xl prose-h3:text-lg",
                  "prose-p:my-2 prose-blockquote:border-l-2 prose-blockquote:border-gray-300 prose-blockquote:pl-4",
                  "prose-pre:bg-gray-100 prose-pre:p-4 prose-pre:rounded-lg",
                  "prose-ul:list-disc prose-ol:list-decimal prose-li:my-1",
                  "[&_.ProseMirror]:min-h-[120px] [&_.ProseMirror]:outline-none"
                )}
              />
            </div>
          </div>
        </div>

        <div className="border-l flex flex-col bg-gray-50 transition-all duration-300 w-1/3">
          <div className="p-4 border-b">
            <div className="mt-4">
              <div className="relative">
                <div className="flex items-center space-x-1.5 overflow-x-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent pb-2 px-1">
                  {statuses.map((status) => (
                    <button
                      key={status.id}
                      type="button"
                      onClick={() => setSelectedStatus(status.id)}
                      className={cn(
                        "px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap",
                        selectedStatus === status.id
                          ? "shadow-lg scale-105 opacity-100 transform-gpu font-semibold"
                          : "hover:shadow-md hover:opacity-90 hover:scale-102 transform-gpu"
                      )}
                      style={{
                        backgroundColor:
                          selectedStatus === status.id ? status.color : `${status.color}20`,
                        color: selectedStatus === status.id ? '#FFF' : status.color,
                        textShadow:
                          selectedStatus === status.id ? '0 1px 2px rgba(0,0,0,0.2)' : 'none',
                      }}
                    >
                      {status.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col">
                  <div className="relative mb-1.5">
                    <span className="text-xs text-gray-500 text-center block">Project</span>
                    <div className="relative flex justify-center">
                      <button
                        type="button"
                        onClick={() => {
                          const overlay = document.getElementById('dropdown-overlay');
                          const menu = document.getElementById('project-menu');
                          if (menu) {
                            const responsibleMenu = document.getElementById('responsible-menu');
                            const coworkerMenu = document.getElementById('coworker-menu');
                            if (responsibleMenu) responsibleMenu.classList.add('hidden');
                            if (coworkerMenu) coworkerMenu.classList.add('hidden');
                            menu.classList.toggle('hidden');
                            if (!menu.classList.contains('hidden')) {
                              overlay?.classList.remove('hidden');
                            }
                          }
                        }}
                        className="flex items-center p-1 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 transition-all duration-200"
                      >
                        <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center">
                          <div className="w-full h-full rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 text-sm font-medium">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                            </svg>
                          </div>
                        </div>
                        <div className="ml-2 text-sm font-medium text-gray-700">
                          {selectedProjectId
                            ? projects.find(p => p.id === selectedProjectId)?.name
                            : 'Select Project'
                          }
                        </div>
                        <ChevronDown className="w-4 h-4 ml-1.5" />
                      </button>

                      <div
                        id="project-menu"
                        className="absolute top-full left-0 mt-1 w-64 bg-white rounded-lg shadow-lg border border-gray-200 py-2 hidden z-50"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            const menu = document.getElementById('project-menu');
                            const overlay = document.getElementById('dropdown-overlay');
                            if (menu) menu.classList.add('hidden');
                            overlay?.classList.add('hidden');
                            setSelectedProjectId('');
                          }}
                          className={cn(
                            "w-full px-4 py-2 text-sm text-left hover:bg-gray-50 flex items-center space-x-2",
                            !selectedProjectId && "bg-gray-50 text-gray-700 font-medium"
                          )}
                        >
                          <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center">
                            <svg className="w-3 h-3 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </div>
                          <span>No Project</span>
                        </button>
                        {projects.map((project) => (
                          <button
                            key={project.id}
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleProjectSelect(project.id);
                            }}
                            className={cn(
                              "w-full px-4 py-2 text-sm text-left hover:bg-gray-50 flex items-center space-x-2",
                              selectedProjectId === project.id && "bg-indigo-50 text-indigo-700 font-medium"
                            )}
                          >
                            <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center text-sm font-medium text-indigo-700">
                              {project.name.charAt(0).toUpperCase()}
                            </div>
                            <span>{project.name}</span>
                            {selectedProjectId === project.id && (
                              <div className="w-4 h-4 rounded-full bg-indigo-500 flex items-center justify-center ml-auto">
                                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                              </div>
                            )}
                          </button>
                        ))}
                      </div>
                      
                      {/* Overlay for closing dropdown */}
                      <div
                        id="dropdown-overlay"
                        className="fixed inset-0 z-40 hidden"
                        onClick={() => {
                          const menu = document.getElementById('project-menu');
                          const overlay = document.getElementById('dropdown-overlay');
                          if (menu) menu.classList.add('hidden');
                          overlay?.classList.add('hidden');
                        }}
                      />
                    </div>
                  </div>
                </div>
                <div className="flex flex-col">
                  <span className="text-xs text-gray-500 text-center mb-1.5 block">Due Date</span>
                  <DatePicker
                    value={selectedDate}
                    onChange={(date) => {
                      setSelectedDate(date);
                    }}
                  />
                </div>
              </div>

              <div>
                <div className="grid grid-cols-3 gap-4 mb-2">
                  <span className="text-xs text-gray-500 text-center">Responsible</span>
                  <span className="text-xs text-gray-500 text-center">Co-workers</span>
                  <span className="text-xs text-gray-500 text-center">Priority</span>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  {/* Responsible Person */}
                  <div className="flex items-center justify-center w-full">
                    <div className="relative">
                      {responsible ? (
                        <div className="relative">
                          <button
                            onClick={() => {
                              const menu = document.getElementById('responsible-menu');
                              if (menu) menu.classList.toggle('hidden');
                            }}
                            className="flex items-center p-1 rounded-full bg-emerald-100 text-emerald-700 ring-2 ring-emerald-200 ring-offset-1 hover:ring-emerald-300"
                          >
                            <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-sm font-medium">
                              {users.find(u => u.id === responsible)?.email.charAt(0).toUpperCase()}
                            </div>
                            <ChevronDown className="w-4 h-4 ml-1.5" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            const menu = document.getElementById('responsible-menu');
                            if (menu) menu.classList.toggle('hidden');
                          }}
                          className="flex items-center p-1 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200"
                        >
                          <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center">
                            <User className="w-4 h-4" />
                          </div>
                          <ChevronDown className="w-4 h-4 ml-1.5" />
                        </button>
                      )}

                      {/* Dropdown Menu */}
                      <div
                        id="responsible-menu"
                        className="absolute top-full left-0 mt-1 w-64 bg-white rounded-lg shadow-lg border border-gray-200 py-2 hidden z-50"
                      >
                        {users.map(user => (
                          <button
                            key={user.id}
                            onClick={() => {
                              handleResponsibleSelect(user.id);
                            }}
                            className={cn(
                              "w-full px-4 py-2 text-sm text-left hover:bg-gray-50 flex items-center space-x-2",
                              responsible === user.id && "bg-emerald-50 text-emerald-700 font-medium"
                            )}
                          >
                            <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center text-sm font-medium text-emerald-700">
                              {user.email.charAt(0).toUpperCase()}
                            </div>
                            <span>{user.email}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Divider */}
                  <div className="h-8 w-px bg-gray-200 hidden"></div>

                  {/* Co-workers */}
                  <div className="flex items-center gap-2 justify-center">
                    {coworkers.map((userId) => (
                      <div key={userId} className="relative">
                        <button
                          onClick={() => {
                            setCoworkers(coworkers.filter(id => id !== userId));
                          }}
                          className="flex items-center p-1 rounded-full bg-indigo-100 text-indigo-700 ring-2 ring-indigo-200 ring-offset-1 hover:ring-indigo-300"
                        >
                          <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-sm font-medium">
                            {users.find(u => u.id === userId)?.email.charAt(0).toUpperCase()}
                          </div>
                        </button>
                      </div>
                    ))}

                    {/* Add Co-worker Button */}
                    {coworkers.length < 4 && (
                      <div className="relative">
                        <button
                          onClick={() => {
                            const menu = document.getElementById('coworker-menu');
                            if (menu) menu.classList.toggle('hidden');
                          }}
                          className="flex items-center p-1 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 transition-all duration-200 cursor-pointer"
                        >
                          <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-sm">
                            <User className="w-4 h-4" />
                          </div>
                          <ChevronDown className="w-4 h-4 ml-1" />
                        </button>

                        {/* Co-worker Dropdown Menu */}
                        <div
                          id="coworker-menu"
                          className="absolute top-full right-0 mt-1 w-64 bg-white rounded-lg shadow-lg border border-gray-200 py-2 hidden z-50 max-h-[240px] overflow-y-auto"
                        >
                          {users.map(user => (
                            <button
                              key={user.id}
                              onClick={() => {
                                handleCoworkerSelect(user.id);
                              }}
                              className={cn(
                                "w-full px-4 py-2 text-sm text-left hover:bg-gray-50 flex items-center",
                                coworkers.includes(user.id) && "bg-indigo-50 text-indigo-700 font-medium",
                                user.id === responsible && "opacity-50 cursor-not-allowed"
                              )}
                            >
                              <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center text-sm font-medium text-indigo-700">
                                {user.email.charAt(0).toUpperCase()}
                              </div>
                              <span className="text-sm flex-1 mx-2 truncate">{user.email}</span>
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
                      </div>
                    )}
                  </div>
                  
                  {/* Priority */}
                  <div className="flex items-center gap-1">
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

          <div className="p-4 bg-white border-t shadow-lg mt-auto">
            <div className="flex w-full gap-3">
              <button
                type="button"
                onClick={onCancel}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 hover:text-gray-500 bg-gray-50 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className={cn(
                  "flex-1 px-4 py-2.5 text-sm font-medium rounded-lg text-white flex items-center justify-center",
                  "bg-gradient-to-r from-violet-500 to-indigo-500 hover:from-violet-600 hover:to-indigo-600",
                  "shadow-md hover:shadow-lg transition-all duration-200",
                  "disabled:opacity-50 disabled:cursor-not-allowed"
                )}
              >
                {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Create Task
              </button>
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}