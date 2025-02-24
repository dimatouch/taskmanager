import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useCompany } from '../../contexts/CompanyContext';
import { 
  User, 
  Clock, 
  ChevronDown,
  Flame,
  CheckSquare,
  X,
  CheckCircle2,
  Loader2,
  Plus,
  File,
  FileText,
  Image,
  AlertCircle,
  Square
} from 'lucide-react';
import { Database } from '../../types/supabase';
import { cn } from '../../lib/utils';
import { userService } from '../../services/userService';
import { DueDatePicker } from './DueDatePicker';
import { supabase } from '../../lib/supabase';
import { taskActivityService } from '../../services/taskActivityService';
import { useTranslation } from '../../lib/i18n/useTranslation';

// Типи
type Task = Database['public']['Tables']['tasks']['Row'];
type TaskStatus = Database['public']['Tables']['task_statuses']['Row'];
type Project = Database['public']['Tables']['projects']['Row'];

// Допоміжні функції
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

interface TaskProps {
  task: Task;
  status: TaskStatus;
  statuses: TaskStatus[];
  projects: Project[];
  users: { id: string; email: string }[];
  onStatusChange?: () => void;
  isSelected?: boolean;
  onSelect?: () => void;
}

export function Task({ 
  task, 
  status, 
  statuses, 
  projects,
  users, 
  onStatusChange, 
  isSelected, 
  onSelect 
}: TaskProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentCompany } = useCompany();
  const { t } = useTranslation();
  const [isOverdue, setIsOverdue] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [savingDate, setSavingDate] = useState(false);
  const [saveDateError, setSaveDateError] = useState<string | null>(null);
  const [saveDateSuccess, setSaveDateSuccess] = useState(false);
  const [showResultModal, setShowResultModal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultInput, setResultInput] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Рефи для кожного дропдауна
  const statusDropdownRef = useRef<HTMLDivElement>(null);
  const responsibleDropdownRef = useRef<HTMLDivElement>(null);
  const coworkersDropdownRef = useRef<HTMLDivElement>(null);
  const priorityDropdownRef = useRef<HTMLDivElement>(null);

  const [dropdownOpen, setDropdownOpen] = useState<{
    status: boolean;
    responsible: boolean;
    coworkers: boolean;
    project: boolean;
    priority: boolean;
    dueDate: boolean;
  }>({
    status: false,
    responsible: false,
    coworkers: false,
    project: false,
    priority: false,
    dueDate: false
  });

  // Додаємо новий стан
  const [selectedCoworkers, setSelectedCoworkers] = useState<string[]>(task.coworkers || []);

  // Закриваємо будь-який відкритий дропдаун, якщо клік відбувся поза ним
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;

      // Статус
      if (
        dropdownOpen.status &&
        statusDropdownRef.current &&
        !statusDropdownRef.current.contains(target)
      ) {
        setDropdownOpen((prev) => ({ ...prev, status: false }));
      }

      // Відповідальний
      if (
        dropdownOpen.responsible &&
        responsibleDropdownRef.current &&
        !responsibleDropdownRef.current.contains(target)
      ) {
        setDropdownOpen((prev) => ({ ...prev, responsible: false }));
      }

      // Співвиконавці
      if (
        dropdownOpen.coworkers &&
        coworkersDropdownRef.current &&
        !coworkersDropdownRef.current.contains(target)
      ) {
        setDropdownOpen((prev) => ({ ...prev, coworkers: false }));
      }

      // Пріоритет
      if (
        dropdownOpen.priority &&
        priorityDropdownRef.current &&
        !priorityDropdownRef.current.contains(target)
      ) {
        setDropdownOpen((prev) => ({ ...prev, priority: false }));
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [dropdownOpen]);

  // Subscribe to task changes
  useEffect(() => {
    const channel = supabase
      .channel('task-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tasks',
          filter: `id=eq.${task.id}`
        },
        (payload) => {
          if (payload.eventType === 'UPDATE') {
            // Call onStatusChange to refresh task data
            onStatusChange?.();
          }
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [task.id]);

  useEffect(() => {
    if (task.due_date) {
      const dueDate = new Date(task.due_date);
      const now = new Date();
      setIsOverdue(dueDate < now && !task.result);
    }
  }, [task.due_date, task.result]);

  const handleStatusChange = async (newStatusId: string) => {
    try {
      setIsUpdating(true);
      setDropdownOpen(prev => ({ ...prev, status: false }));
      
      // Check if trying to set status to Done
      const doneStatus = statuses.find(s => s.name === 'Done');
      if (doneStatus && newStatusId === doneStatus.id) {
        setShowResultModal(true);
        return;
      }

      const { error } = await supabase
        .from('tasks')
        .update({ 
          status_id: newStatusId,
          updated_at: new Date().toISOString()
        })
        .eq('id', task.id);

      if (error) throw error;

      await taskActivityService.logActivity({
        taskId: task.id,
        field: 'status',
        oldValue: task.status_id,
        newValue: newStatusId,
        type: 'update'
      });

      onStatusChange?.();
    } catch (err) {
      console.error('Failed to update status:', err); 
      setError(err instanceof Error ? err.message : 'Failed to update status');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCompleteTask = async () => {
    try {
      setIsUpdating(true);
      setUploadError(null);
      
      if (!resultInput.trim()) {
        throw new Error('Please enter a result');
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No authenticated user');

      const doneStatus = statuses.find(s => s.name === 'Done');
      if (!doneStatus) throw new Error('Done status not found');

      // Upload files first
      const uploadedFiles = [];
      for (const file of files) {
        // Validate file size
        if (file.size > 52428800) { // 50MB
          throw new Error(`File ${file.name} is too large (max 50MB)`);
        }

        // Санітизуємо назву файлу
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

      // Combine existing and new files
      const allFiles = [
        ...existingFiles.filter(ef => !uploadedFiles.some(uf => uf.path === ef.path)),
        ...uploadedFiles
      ];

      const { error: taskError } = await supabase
        .from('tasks')
        .update({
          status_id: doneStatus.id,
          result: resultInput,
          files: allFiles,
          updated_at: new Date().toISOString()
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

      await taskActivityService.logActivity({
        taskId: task.id,
        field: 'result',
        oldValue: task.result,
        newValue: resultInput,
        type: 'update'
      });

      onStatusChange?.();
      setShowResultModal(false);
      setResultInput('');
    } catch (err) {
      console.error('Failed to complete task:', err);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleResponsibleChange = async (userId: string) => {
    try {
      setIsUpdating(true);
      const { error } = await supabase
        .from('tasks')
        .update({ 
          responsible_id: userId,
          coworkers: task.coworkers?.filter(id => id !== userId) || [],
          updated_at: new Date().toISOString()
        })
        .eq('id', task.id);

      if (error) throw error;

      await taskActivityService.logActivity({
        taskId: task.id,
        field: 'responsible',
        oldValue: task.responsible_id || '',
        newValue: userId,
        type: 'update'
      });

      onStatusChange?.();
    } catch (err) {
      console.error('Failed to update responsible:', err);
      setError(err instanceof Error ? err.message : 'Failed to update responsible');
    } finally {
      setIsUpdating(false);
      setDropdownOpen(prev => ({ ...prev, responsible: false }));
    }
  };

  // Оновлюємо функцію handleCoworkerChange
  const handleCoworkerChange = async (newCoworkers: string[]) => {
    try {
      setIsUpdating(true);

      const { error } = await supabase
        .from('tasks')
        .update({ 
          coworkers: newCoworkers,
          updated_at: new Date().toISOString()
        })
        .eq('id', task.id);

      if (error) throw error;

      await taskActivityService.logActivity({
        taskId: task.id,
        field: 'co-workers',
        oldValue: task.coworkers?.join(',') || '',
        newValue: newCoworkers.join(','),
        type: 'update'
      });

      onStatusChange?.();
    } catch (err) {
      console.error('Failed to update coworkers:', err);
      setError(err instanceof Error ? err.message : 'Failed to update coworkers');
    } finally {
      setIsUpdating(false);
    }
  };

  const handlePriorityChange = async (priority: number) => {
    try {
      setIsUpdating(true);
      const { error } = await supabase
        .from('tasks')
        .update({ 
          priority,
          updated_at: new Date().toISOString()
        })
        .eq('id', task.id);

      if (error) throw error;

      await taskActivityService.logActivity({
        taskId: task.id,
        field: 'priority',
        oldValue: String(task.priority),
        newValue: String(priority),
        type: 'update'
      });

      onStatusChange?.();
    } catch (err) {
      console.error('Failed to update priority:', err);
      setError(err instanceof Error ? err.message : 'Failed to update priority');
    } finally {
      setIsUpdating(false);
      setDropdownOpen(prev => ({ ...prev, priority: false }));
    }
  };

  const handleTaskClick = () => {
    // Отримуємо поточні параметри URL
    const searchParams = new URLSearchParams(location.search);
    const currentView = searchParams.get('view');
    
    if (currentCompany) {
      navigate(`/${currentCompany.id}/tasks/${task.id}`, {
        state: { 
          background: location,
          returnTo: location.pathname + (currentView ? `?view=${currentView}` : ''),
          fromList: true
        }
      });
    }
  };

  // рендер
  return (
    <div className="contents group" style={{ gridColumn: "1 / -1" }}>
      {/* Title and Priority */}
      <div
        className={cn(
          "col-span-3 px-6 py-4 border-b transition-colors group-hover:bg-gray-50/80",
          isOverdue && "bg-red-50/60 group-hover:bg-red-100/60",
          isSelected && "bg-indigo-50/50"
        )}
      >
        <div
          className={cn(
            "flex items-center gap-4 h-10 relative",
            task.is_subtask &&
              "pl-8 relative before:absolute before:left-3 before:top-1/2 before:-translate-y-1/2 before:w-3 before:h-px before:bg-gray-300"
          )}
        >
          {onSelect && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onSelect();
              }}
              className={cn(
                "absolute -left-3 flex items-center justify-center w-4 h-4 rounded",
                (isSelected || window.selectedTasksCount > 0)
                  ? "opacity-100" 
                  : "opacity-0 group-hover:opacity-100",
                isSelected 
                  ? "text-indigo-600 bg-indigo-50 hover:bg-indigo-100" 
                  : "text-gray-400 hover:text-gray-600 hover:bg-gray-100"
              )}
            >
              {isSelected ? (
                <CheckSquare className="w-3.5 h-3.5 stroke-[2]" />
              ) : (
                <Square className="w-3.5 h-3.5 stroke-[2]" />
              )}
            </button>
          )}
          <div
            onClick={handleTaskClick}
            className="flex-1 min-w-0 cursor-pointer pl-4"
          >
            <h3 className={cn(
              "text-[13px] font-medium truncate",
              task.is_subtask ? "text-gray-500" : "text-gray-900"
            )}>
              {task.title}
            </h3>
          </div>

          {/* Priority */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setDropdownOpen((prev) => ({
                ...prev,
                priority: !prev.priority
              }));
            }}
            className={cn(
              "p-1 rounded transition-colors",
              task.priority > 0
                ? "bg-amber-100 text-amber-700"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            )}
          >
            {task.priority > 0 ? (
              <div className="flex -space-x-1">
                {Array.from({ length: task.priority }).map((_, i) => (
                  <Flame
                    key={i}
                    className="w-3 h-3 fill-current"
                    style={{ transform: `translateX(${i * 2}px)` }}
                  />
                ))}
              </div>
            ) : (
              <Flame className="w-3 h-3" />
            )}
          </button>

          {dropdownOpen.priority && (
            <div
              ref={priorityDropdownRef}
              className="absolute right-0 mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50"
            >
              {[
                { level: 0, label: 'No Priority' },
                { level: 1, label: 'Low Priority' },
                { level: 2, label: 'Medium Priority' },
                { level: 3, label: 'High Priority' }
              ].map(({ level, label }) => (
                <button
                  key={level}
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePriorityChange(level);
                  }}
                  className={cn(
                    "w-full px-3 py-1.5 text-sm text-left hover:bg-gray-50 flex items-center justify-between",
                    task.priority === level && "bg-amber-50 text-amber-700"
                  )}
                >
                  <span>{label}</span>
                  {level > 0 && (
                    <div className="flex -space-x-1">
                      {Array.from({ length: level }).map((_, i) => (
                        <Flame
                          key={i}
                          className={cn(
                            "w-3.5 h-3.5",
                            task.priority >= level && "fill-current"
                          )}
                          style={{ transform: `translateX(${i * 2}px)` }}
                        />
                      ))}
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Status */}
      <div
        className={cn(
          "col-span-1 px-6 py-4 border-b transition-colors group-hover:bg-gray-50/80",
          isOverdue && "bg-red-50/60 group-hover:bg-red-100/60",
          isSelected && "bg-indigo-50/50"
        )}
      >
        <div className="relative flex justify-center items-center h-10">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setDropdownOpen((prev) => ({
                ...prev,
                status: !prev.status
              }));
            }}
            className="w-full flex items-center justify-center gap-2 h-7 px-3 rounded-full hover:bg-gray-50 transition-colors"
            disabled={isUpdating}
          >
            <div
              className="w-1.5 h-1.5 rounded-full"
              style={{ backgroundColor: status.color }}
            />
            <span className="text-xs font-medium text-gray-700">{status.name}</span>
          </button>

          {dropdownOpen.status && (
            <div
              ref={statusDropdownRef}
              className="absolute top-full left-1/2 -translate-x-1/2 mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50"
            >
              {statuses.map((s) => (
                <button
                  key={s.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleStatusChange(s.id);
                  }}
                  className={cn(
                    "w-full px-3 py-1.5 text-sm text-left hover:bg-gray-50 flex items-center gap-2",
                    task.status_id === s.id && "bg-gray-50"
                  )}
                >
                  <div
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ backgroundColor: s.color }}
                  />
                  <span>{s.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Responsible */}
      <div
        className={cn(
          "col-span-1 px-6 py-4 border-b transition-colors group-hover:bg-gray-50/80",
          isOverdue && "bg-red-50/60 group-hover:bg-red-100/60",
          isSelected && "bg-indigo-50/50"
        )}
      >
        <div className="flex items-center justify-center h-10">
          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setDropdownOpen((prev) => ({
                  ...prev,
                  responsible: !prev.responsible
                }));
              }}
              className="flex items-center p-1 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200"
            >
              <div 
                className="w-6 h-6 rounded-full bg-white flex items-center justify-center group/avatar relative"
                title={task.responsible_id ? userService.formatUserName(users.find(u => u.id === task.responsible_id)!) : 'Не призначено'}
              >
                {task.responsible_id ? (
                  <>
                    <span className="text-[10px] font-medium text-emerald-700">
                      {users.find((u) => u.id === task.responsible_id)?.email.charAt(0).toUpperCase()}
                    </span>
                    <div className="absolute invisible group-hover/avatar:visible bg-gray-900 text-white text-xs py-1 px-2 rounded-md -top-8 whitespace-nowrap z-[100]">
                      {userService.formatUserName(users.find(u => u.id === task.responsible_id)!)}
                    </div>
                  </>
                ) : (
                  <User className="w-3 h-3" />
                )}
              </div>
            </button>

            {dropdownOpen.responsible && (
              <div
                ref={responsibleDropdownRef}
                className="absolute top-full mt-1 w-64 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50"
              >
                {users.map((user) => (
                  <button
                    key={user.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleResponsibleChange(user.id);
                    }}
                    className={cn(
                      "w-full px-3 py-1.5 text-sm text-left hover:bg-gray-50 flex items-center gap-2",
                      task.responsible_id === user.id && "bg-emerald-50/50"
                    )}
                  >
                    <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center">
                      <span className="text-[10px] font-medium text-emerald-700">
                        {user.email.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <span>{userService.formatUserName(user)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Co-workers */}
      <div
        className={cn(
          "col-span-1 px-6 py-4 border-b transition-colors group-hover:bg-gray-50/80",
          isOverdue && "bg-red-50/60 group-hover:bg-red-100/60",
          isSelected && "bg-indigo-50/50"
        )}
      >
        <div className="flex items-center justify-center gap-1">
          <div className="flex items-center -space-x-2 relative">
            {task.coworkers?.slice(0, 2).map((userId) => {
              const user = users.find((u) => u.id === userId);
              if (!user) return null;
              return (
                <div
                  key={userId}
                  className="w-6 h-6 rounded-full bg-indigo-100 ring-2 ring-white flex items-center justify-center group/avatar relative"
                  title={userService.formatUserName(user)}
                >
                  <span className="text-[10px] font-medium text-indigo-700">
                    {user.email.charAt(0).toUpperCase()}
                  </span>
                  <div className="absolute invisible group-hover/avatar:visible bg-gray-900 text-white text-xs py-1 px-2 rounded-md -top-8 whitespace-nowrap z-[100]">
                    {userService.formatUserName(user)}
                  </div>
                </div>
              );
            })}
            {(task.coworkers?.length || 0) > 2 && (
              <div 
                className="w-6 h-6 rounded-full bg-indigo-50 ring-2 ring-white flex items-center justify-center group/avatar relative"
                title={`+${task.coworkers!.length - 2} співвиконавців`}
              >
                <span className="text-[10px] font-medium text-indigo-600">
                  +{task.coworkers!.length - 2}
                </span>
                <div className="absolute invisible group-hover/avatar:visible bg-gray-900 text-white text-xs py-1 px-2 rounded-md -top-8 whitespace-nowrap z-[100]">
                  {task.coworkers!.slice(2).map(userId => {
                    const user = users.find(u => u.id === userId);
                    return user ? userService.formatUserName(user) : '';
                  }).join(', ')}
                </div>
              </div>
            )}
          </div>

          {/* Кнопка додавання */}
          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setDropdownOpen((prev) => ({
                  ...prev,
                  coworkers: !prev.coworkers,
                  responsible: false
                }));
              }}
              className="flex items-center p-1 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200"
            >
              <div className="w-6 h-6 rounded-full bg-white flex items-center justify-center">
                <Plus className="w-3 h-3" />
              </div>
            </button>
            
            {/* Оновлюємо логіку вибору коворкерів */}
            {dropdownOpen.coworkers && (
              <div
                ref={coworkersDropdownRef}
                className="absolute top-full mt-1 w-64 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50"
              >
                <div className="p-2 flex justify-between items-center border-b">
                  <span className="text-xs text-gray-500">Обрано: {selectedCoworkers.length}</span>
                  <button
                    onClick={async (e) => {
                      e.stopPropagation();
                      if (selectedCoworkers.length > 0) {
                        await handleCoworkerChange(selectedCoworkers);
                        setDropdownOpen(prev => ({ ...prev, coworkers: false }));
                      }
                    }}
                    className="px-2 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50 rounded"
                  >
                    Зберегти
                  </button>
                </div>
                {users.map((user) => {
                  const isCoworker = task.coworkers?.includes(user.id);
                  const isResponsible = user.id === task.responsible_id;
                  const isSelected = selectedCoworkers.includes(user.id);
                  
                  return (
                    <button
                      key={user.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (isResponsible) return;
                        
                        setSelectedCoworkers(prev => 
                          isSelected 
                            ? prev.filter(id => id !== user.id)
                            : [...prev, user.id]
                        );
                      }}
                      disabled={isResponsible}
                      className={cn(
                        "w-full px-3 py-1.5 text-sm text-left hover:bg-gray-50 flex items-center justify-between",
                        isSelected && "bg-indigo-50/50",
                        isResponsible && "opacity-50 cursor-not-allowed"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded-md border flex items-center justify-center">
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-indigo-600" />
                          ) : (
                            <Square className="w-4 h-4 text-gray-400" />
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center">
                            <span className="text-[10px] font-medium text-indigo-700">
                              {user.email.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <span>{userService.formatUserName(user)}</span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Due Date */}
      <div
        className={cn(
          "col-span-1 px-6 py-4 border-b transition-colors group-hover:bg-gray-50/80",
          isOverdue && "bg-red-50/60 group-hover:bg-red-100/60",
          isSelected && "bg-indigo-50/50"
        )}
      >
        <div className="flex items-center justify-center h-10">
          <DueDatePicker
            selectedDate={task.due_date || ''}
            onChange={async (date) => {
              try {
                setSavingDate(true);
                setSaveDateError(null);
                setSaveDateSuccess(false);

                const { error } = await supabase
                  .from('tasks')
                  .update({ 
                    due_date: date || null,
                    updated_at: new Date().toISOString()
                  })
                  .eq('id', task.id);

                if (error) throw error;

                await taskActivityService.logActivity({
                  taskId: task.id,
                  field: 'due_date',
                  oldValue: task.due_date || '',
                  newValue: date || '',
                  type: 'update'
                });

                setSaveDateSuccess(true);
                setTimeout(() => setSaveDateSuccess(false), 2000);
                onStatusChange?.();
              } catch (err) {
                console.error('Failed to update due date:', err);
                setSaveDateError(
                  err instanceof Error ? err.message : 'Failed to update due date'
                );
                setTimeout(() => setSaveDateError(null), 2000);
              } finally {
                setSavingDate(false);
              }
            }}
            variant="transparent"
          />
        </div>
      </div>

      {/* Creation Date */}
      <div
        className={cn(
          "col-span-1 px-6 py-4 border-b transition-colors group-hover:bg-gray-50/80",
          isOverdue && "bg-red-50/60 group-hover:bg-red-100/60",
          isSelected && "bg-indigo-50/50"
        )}
      >
        <div className="flex items-center justify-center h-10">
          <div className="flex items-center">
            <Clock className="w-3.5 h-3.5 text-gray-400" />
            <span className="text-xs text-gray-500 ml-1.5">
              {new Date(task.created_at).toLocaleDateString()}
            </span>
          </div>
        </div>
      </div>

      {/* Result Modal */}
      {showResultModal && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-[2px] flex items-center justify-center p-4 z-[70] animate-in fade-in duration-200">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl">
            <div className="px-6 py-4 flex items-center justify-between border-b bg-gradient-to-r from-emerald-50 to-white">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    Complete Task
                  </h3>
                  <p className="text-sm text-gray-500 mt-0.5">
                    Опишіть результати та досягнення
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowResultModal(false)}
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Task Result
                </label>
                <p className="text-sm text-gray-500 mb-3">
                  Please describe what was accomplished and any important notes
                </p>
                {error && (
                  <div className="mb-4 rounded-lg bg-red-50 p-4 flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-red-600">{error}</p>
                  </div>
                )}
                <textarea
                  value={resultInput}
                  onChange={(e) => setResultInput(e.target.value)}
                  className={cn(
                    "w-full px-4 py-3 text-sm rounded-lg transition-all min-h-[200px]",
                    "border border-gray-200 focus:border-indigo-500",
                    "focus:ring-2 focus:ring-indigo-500/10",
                    "placeholder:text-gray-400",
                    "resize-none h-32"
                  )}
                  placeholder="Enter task completion result..."
                />
              </div>

              {/* File Upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Прикріпити файли ({files.length})
                </label>
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.jpg,.jpeg,.png,.gif"
                  multiple
                  onChange={(e) => {
                    const newFiles = Array.from(e.target.files || []);
                    setFiles([...files, ...newFiles]);
                  }}
                />
                <div className="flex flex-wrap gap-3 mb-3">
                  {files.map((file, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 rounded-lg"
                    >
                      {file.type.startsWith('image/') ? (
                        <Image className="w-4 h-4 text-blue-500" />
                      ) : file.type.includes('pdf') ? (
                        <FileText className="w-4 h-4 text-red-500" />
                      ) : (
                        <File className="w-4 h-4 text-gray-500" />
                      )}
                      <span className="text-sm text-gray-600">
                        {file.name}
                        <span className="text-gray-400 ml-2">
                          ({formatFileSize(file.size)})
                        </span>
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setFiles(files.filter((_, i) => i !== index))
                        }
                        className="p-1 hover:bg-gray-200 rounded-full text-gray-400 hover:text-gray-600"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    className={cn(
                      "px-4 py-2 text-sm font-medium rounded-lg transition-colors",
                      "text-gray-600 hover:text-gray-700",
                      "bg-gray-100 hover:bg-gray-200",
                      "flex items-center gap-2",
                      "disabled:opacity-50 disabled:cursor-not-allowed"
                    )}
                  >
                    {isUploading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Plus className="w-4 h-4" />
                    )}
                    Add Files
                  </button>
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowResultModal(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCompleteTask}
                  disabled={isUpdating || !resultInput.trim() || isUploading}
                  className={cn(
                    "px-4 py-2 text-sm font-medium rounded-lg",
                    "bg-gradient-to-r from-emerald-600 to-teal-600 text-white",
                    "hover:from-emerald-500 hover:to-teal-500",
                    "shadow-sm hover:shadow",
                    "flex items-center gap-2",
                    "disabled:opacity-50 disabled:cursor-not-allowed"
                  )}
                >
                  {isUpdating || isUploading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {isUploading ? 'Uploading...' : 'Completing task...'}
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      Complete Task
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
