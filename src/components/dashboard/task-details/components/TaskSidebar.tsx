import { 
  useState, 
  useEffect, 
  useRef, 
  useCallback 
} from 'react';

import {
  User,
  Flame,
  ChevronDown,
  Loader2,
  CheckCircle2,
  AlertCircle,
  FolderKanban,
  X,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

import type { Database } from '../../../../types/supabase'; 
import { cn } from '../../../../lib/utils';
import { userService } from '../../../../services/userService';
import { supabase } from '../../../../lib/supabase';
import { taskActivityService } from '../../../../services/taskActivityService';
import { useTranslation } from '../../../../lib/i18n/useTranslation';
import { DueDatePicker } from '../../DueDatePicker';
import { Clock } from 'lucide-react';

//
// Типи з вашої бази (приклад)
//
type Task = Database['public']['Tables']['tasks']['Row'] & {
  coworkers?: string[];
};
type TaskStatus = Database['public']['Tables']['task_statuses']['Row'];
type Project = Database['public']['Tables']['projects']['Row'];

interface TaskSidebarProps {
  task: Task;
  statuses: TaskStatus[];
  projects: Project[];
  selectedStatus: string;
  setSelectedStatus: (id: string) => void;
  creator?: { email: string } | null;
  onAssigneesChange?: (responsible: string | null, coworkers: string[]) => void;
  isSubtask?: boolean;
  onStatusChange?: () => void;
}

//
// Допоміжна функція для форматування розміру файлу
//
function formatFileSize(bytes: number) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}



export function TaskSidebar({
  task,
  statuses,
  projects,
  selectedStatus,
  setSelectedStatus,
  creator,
  onAssigneesChange,
  isSubtask,
  onStatusChange
}: TaskSidebarProps) {
  const { t } = useTranslation();

  // Dropdown-и
  const [dropdownsVisible, setDropdownsVisible] = useState({
    status: false,
    responsible: false,
    coworkers: false,
    project: false,
    priority: false
  });

  // Стан для задачі
  const [localPriority, setLocalPriority] = useState(task.priority);
  const [responsible, setResponsible] = useState<string | null>(task.responsible_id);
  const [coworkers, setCoworkers] = useState<string[]>(task.coworkers || []);
  const [selectedProject, setSelectedProject] = useState<string | null>(task.project_id);

  // Стан для користувачів
  const [users, setUsers] = useState<{ id: string; email: string; first_name?: string; last_name?: string }[]>([]);

  // Стан для збереження
  const [isUpdating, setIsUpdating] = useState(false);
  const [savingCoworker, setSavingCoworker] = useState(false);
  const [saveCoworkerSuccess, setSaveCoworkerSuccess] = useState(false);
  const [saveCoworkerError, setSaveCoworkerError] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [savingStatus, setSavingStatus] = useState(false);
  const [saveStatusSuccess, setSaveStatusSuccess] = useState(false);
  const [saveStatusError, setSaveStatusError] = useState(false);
  const [savingProject, setSavingProject] = useState(false);
  const [saveProjectSuccess, setSaveProjectSuccess] = useState(false);
  const [saveProjectError, setSaveProjectError] = useState(false);
  const [savingDate, setSavingDate] = useState(false);
  const [saveDateError, setSaveDateError] = useState<string | null>(null);
  const [saveDateSuccess, setSaveDateSuccess] = useState(false);

  // Стан для календаря
  const [isAddingToCalendar, setIsAddingToCalendar] = useState(false);
  const [calendarError, setCalendarError] = useState<string | null>(null);

  // Кнопка завершення задачі
  const [isCompleteButtonVisible, setIsCompleteButtonVisible] = useState(true);
  const [showResultModal, setShowResultModal] = useState(false);

  // Refs для dropdown-ів
  const priorityDropdownRef = useRef<HTMLDivElement>(null);
  const responsibleDropdownRef = useRef<HTMLDivElement>(null);
  const coworkerDropdownRef = useRef<HTMLDivElement>(null);
  const projectDropdownRef = useRef<HTMLDivElement>(null);
  const statusDropdownRef = useRef<HTMLDivElement>(null);

  // Timeout-и
  const saveTimeoutRef = useRef<NodeJS.Timeout>();
  const saveCoworkerTimeoutRef = useRef<NodeJS.Timeout>();
  const saveStatusTimeoutRef = useRef<NodeJS.Timeout>();
  const saveProjectTimeoutRef = useRef<NodeJS.Timeout>();

  // Додайте новий стейт для локальної дати
  const [localDueDate, setLocalDueDate] = useState<string | null>(task.due_date);

  // Закриття dropdown-ів та вкладень при кліку поза ними
  useEffect(() => {
    const handleDocumentClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (dropdownsVisible.status && statusDropdownRef.current && !statusDropdownRef.current.contains(target)) {
        setDropdownsVisible(prev => ({ ...prev, status: false }));
      }
      if (dropdownsVisible.project && projectDropdownRef.current && !projectDropdownRef.current.contains(target)) {
        setDropdownsVisible(prev => ({ ...prev, project: false }));
      }
      if (dropdownsVisible.priority && priorityDropdownRef.current && !priorityDropdownRef.current.contains(target)) {
        setDropdownsVisible(prev => ({ ...prev, priority: false }));
      }
      if (dropdownsVisible.responsible && responsibleDropdownRef.current && !responsibleDropdownRef.current.contains(target)) {
        setDropdownsVisible(prev => ({ ...prev, responsible: false }));
      }
      if (dropdownsVisible.coworkers && coworkerDropdownRef.current && !coworkerDropdownRef.current.contains(target)) {
        setDropdownsVisible(prev => ({ ...prev, coworkers: false }));
      }
    };

    document.addEventListener('mousedown', handleDocumentClick, true);
    return () => {
      document.removeEventListener('mousedown', handleDocumentClick, true);
    };
  }, [dropdownsVisible]);

  // Завантаження користувачів
  useEffect(() => {
    (async () => {
      try {
        const fetchedUsers = await userService.getUsers();
        setUsers(fetchedUsers);
      } catch (err) {
        console.error('Failed to load users:', err);
      }
    })();
  }, [task]);

  // Синхронізація стану задачі
  useEffect(() => {
    setResponsible(task.responsible_id);
    setCoworkers(task.coworkers || []);
    const doneStatus = statuses.find(s => s.name === 'Done');
    setIsCompleteButtonVisible(task.status_id !== doneStatus?.id);
  }, [task, statuses]);

  // Додайте useEffect для синхронізації з пропсами
  useEffect(() => {
    setLocalDueDate(task.due_date);
  }, [task.due_date]);

  // ---------------------------
  // Методи для збереження інших змін
  // ---------------------------
  const handleProjectChange = async (projectId: string | null) => {
    setDropdownsVisible(prev => ({ ...prev, project: false }));
    setSelectedProject(projectId);

    try {
      setSavingProject(true);
      setSaveProjectSuccess(false);
      setSaveProjectError(false);

      const { error } = await supabase
        .from('tasks')
        .update({
          project_id: projectId
        })
        .eq('id', task.id);

      if (error) throw error;

      await taskActivityService.logActivity({
        taskId: task.id,
        field: 'project',
        oldValue: task.project_id?.toString() || '',
        newValue: projectId?.toString() || '',
        type: 'update'
      });

      setSavingProject(false);
      setSaveProjectSuccess(true);
      saveProjectTimeoutRef.current = setTimeout(() => {
        setSaveProjectSuccess(false);
      }, 2000);

    } catch (err) {
      console.error('Failed to update project:', err);
      setSavingProject(false);
      setSaveProjectError(true);
      setSelectedProject(task.project_id);
      saveProjectTimeoutRef.current = setTimeout(() => {
        setSaveProjectError(false);
      }, 2000);
    }
  };

  const handleSaveCoworkers = useCallback(
    async (newCoworkers: string[]) => {
      if (saveCoworkerTimeoutRef.current) {
        clearTimeout(saveCoworkerTimeoutRef.current);
      }
      setSavingCoworker(true);
      setSaveCoworkerSuccess(false);
      setSaveCoworkerError(false);

      try {
        const { error } = await supabase
          .from('tasks')
          .update({
            coworkers: newCoworkers,
            updated_at: new Date().toISOString(),
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

        setSavingCoworker(false);
        setSaveCoworkerSuccess(true);
        saveCoworkerTimeoutRef.current = setTimeout(() => {
          setSaveCoworkerSuccess(false);
        }, 2000);

      } catch (err) {
        console.error('Failed to update co-workers:', err);
        setSavingCoworker(false);
        setSaveCoworkerError(true);
        saveCoworkerTimeoutRef.current = setTimeout(() => {
          setSaveCoworkerError(false);
        }, 2000);
      }
    },
    [task.id, task.coworkers]
  );

  const handlePriorityChange = async (level: number) => {
    setLocalPriority(level);
    setDropdownsVisible(prev => ({ ...prev, priority: false }));

    try {
      const { error } = await supabase
        .from('tasks')
        .update({ priority: level })
        .eq('id', task.id);

      if (error) {
        setLocalPriority(task.priority);
        throw error;
      }

      await taskActivityService.logActivity({
        taskId: task.id,
        field: 'priority',
        oldValue: String(task.priority),
        newValue: String(level),
        type: 'update'
      });

    } catch (err) {
      console.error('Failed to update priority:', err);
      setLocalPriority(task.priority);
    }
  };

  const handleStatusChange = async (statusId: string) => {
    if (saveStatusTimeoutRef.current) {
      clearTimeout(saveStatusTimeoutRef.current);
    }
    setSavingStatus(true);
    setSaveStatusSuccess(false);
    setSaveStatusError(false);

    try {
      const { error } = await supabase
        .from('tasks')
        .update({
          status_id: statusId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', task.id);

      if (error) throw error;

      await taskActivityService.logActivity({
        taskId: task.id,
        field: 'status',
        oldValue: task.status_id,
        newValue: statusId,
        type: 'update'
      });

      setSavingStatus(false);
      setSaveStatusSuccess(true);
      saveStatusTimeoutRef.current = setTimeout(() => {
        setSaveStatusSuccess(false);
      }, 2000);

      setSelectedStatus(statusId);

      const doneStatus = statuses.find(s => s.name === 'Done');
      if (statusId === doneStatus?.id) {
        setShowResultModal(true);
      }

      setDropdownsVisible(prev => ({ ...prev, status: false }));

    } catch (err) {
      console.error('Failed to update status:', err);
      setSavingStatus(false);
      setSaveStatusError(true);
      saveStatusTimeoutRef.current = setTimeout(() => {
        setSaveStatusError(false);
      }, 2000);
    }
  };

  const handleResponsibleChange = async (userId: string) => {
    try {
      setIsUpdating(true);
      const { error } = await supabase
        .from('tasks')
        .update({
          responsible_id: userId,
          coworkers: coworkers.filter(id => id !== userId),
          updated_at: new Date().toISOString()
        })
        .eq('id', task.id);

      if (error) throw error;

      setResponsible(userId);
      setCoworkers(prev => prev.filter(id => id !== userId));
      onAssigneesChange?.(userId, coworkers.filter(id => id !== userId));

    } catch (err) {
      console.error('Failed to update responsible:', err);
    } finally {
      setIsUpdating(false);
      setDropdownsVisible(prev => ({ ...prev, responsible: false }));
    }
  };

  const handleCoworkerChange = async (userId: string) => {
    if (savingCoworker) return;
    if (userId === responsible) return;

    const isRemoving = coworkers.includes(userId);
    const newCoworkers = isRemoving
      ? coworkers.filter(id => id !== userId)
      : [...coworkers, userId];

    setCoworkers(newCoworkers);
    onAssigneesChange?.(responsible, newCoworkers);
    await handleSaveCoworkers(newCoworkers);
  };

  // Додавання події у календар
  const handleAddToCalendar = async () => {
    try {
      setIsAddingToCalendar(true);
      setCalendarError(null);

      const settings = await calendarService.getSettings();
      if (!settings?.google_calendar_id) {
        throw new Error('Please connect Google Calendar first');
      }

      await calendarService.createEvent({
        summary: task.title,
        description: task.description || '',
        start: {
          dateTime: new Date(task.due_date).toISOString(),
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
        },
        end: {
          dateTime: new Date(new Date(task.due_date).getTime() + 60 * 60 * 1000).toISOString(),
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
        }
      });

    } catch (err) {
      console.error('Failed to add to calendar:', err);
      setCalendarError(err instanceof Error ? err.message : 'Failed to add to calendar');
    } finally {
      setIsAddingToCalendar(false);
    }
  };

  return (
    <div className="flex flex-col w-[30%] border-l bg-gray-50/50 overflow-visible relative">
      <div className="flex-1 overflow-visible scrollbar-thin scrollbar-thumb-gray-300 flex flex-col items-center">
        <div className="w-full max-w-md">
          {/* Due Date - тепер перед асайнментом і з оновленими стилями */}
          <div className="p-6 bg-white border-b">
            <div className="flex items-center gap-2 mb-4">
              <Clock className="w-5 h-5 text-indigo-600" />
              <span className="text-base font-semibold text-gray-900">Due Date</span>
            </div>
            <div className="flex flex-col items-center bg-gradient-to-br from-indigo-50/50 to-white p-4 rounded-xl border border-indigo-100/50 shadow-sm">
              <DueDatePicker
                selectedDate={localDueDate || ''}
                onChange={async (date) => {
                  try {
                    setSavingDate(true);
                    setSaveDateError(null);
                    setSaveDateSuccess(false);
                    
                    // Одразу оновлюємо локальний стан
                    setLocalDueDate(date);

                    const { error } = await supabase
                      .from('tasks')
                      .update({ 
                        due_date: date || null,
                        updated_at: new Date().toISOString()
                      })
                      .eq('id', task.id);

                    if (error) {
                      // Якщо помилка - повертаємо попереднє значення
                      setLocalDueDate(task.due_date);
                      throw error;
                    }

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
                    setSelectedStatus(task.status_id);
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
                variant="default"
                showNoDateButton={true}
                showQuickButtons={true}
                className="w-full max-w-[320px]"
              />
            </div>
            {savingDate && (
              <div className="mt-4 text-sm text-gray-500 flex items-center justify-center bg-gray-50 p-2 rounded-lg">
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Saving changes...
              </div>
            )}
            {saveDateError && (
              <div className="mt-4 text-sm text-red-500 flex items-center justify-center bg-red-50 p-2 rounded-lg">
                <AlertCircle className="w-4 h-4 mr-2" />
                {saveDateError}
              </div>
            )}
            {saveDateSuccess && (
              <div className="mt-4 text-sm text-emerald-500 flex items-center justify-center bg-emerald-50 p-2 rounded-lg">
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Date updated successfully
              </div>
            )}
          </div>

          {/* Status & Project */}
          <div className="p-6 bg-white border-b">
            <div className="grid grid-cols-2 gap-4">
              {/* Status */}
              <div>
                <span className="text-xs font-medium text-gray-500 block mb-4">Status</span>
                <div className="relative" ref={statusDropdownRef}>
                  <button
                    type="button"
                    onClick={() => setDropdownsVisible(prev => ({ ...prev, status: !prev.status }))}
                    className="w-full h-10 flex items-center p-2 rounded-lg transition-all duration-200 bg-gray-100 text-gray-600 hover:bg-gray-200"
                  >
                    <div className="w-6 h-6 rounded-full bg-white flex items-center justify-center">
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: statuses.find(s => s.id === selectedStatus)?.color }}
                      />
                    </div>
                    <div className="ml-2 text-sm font-medium text-gray-700 flex-1 text-left truncate">
                      {statuses.find(s => s.id === selectedStatus)?.name || "Select Status"}
                    </div>
                    <ChevronDown className="w-4 h-4 ml-1 flex-shrink-0" />
                  </button>

                  {dropdownsVisible.status && (
                    <div className="absolute top-full left-0 mt-1 w-full bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-[9999]">
                      {statuses.map(status => (
                        <button
                          key={status.id}
                          type="button"
                          onClick={() => handleStatusChange(status.id)}
                          className={cn(
                            "w-full px-4 py-2 text-sm text-left hover:bg-gray-50 flex items-center gap-3",
                            selectedStatus === status.id && "bg-gray-50 font-medium"
                          )}
                          style={{
                            color: selectedStatus === status.id ? status.color : undefined
                          }}
                        >
                          <div 
                            className="w-6 h-6 rounded-full flex items-center justify-center"
                            style={{ backgroundColor: status.color }}
                          >
                            <div className="w-2 h-2 rounded-full bg-white" />
                          </div>
                          <span>{status.name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Project */}
              <div>
                <span className="text-xs font-medium text-gray-500 block mb-4">Project</span>
                <div className="relative" ref={projectDropdownRef}>
                  <button
                    type="button"
                    onClick={() => setDropdownsVisible(prev => ({ ...prev, project: !prev.project }))}
                    className="w-full h-10 flex items-center p-2 rounded-lg transition-all duration-200 bg-gray-100 text-gray-600 hover:bg-gray-200"
                  >
                    <div className="w-6 h-6 rounded-full bg-white flex items-center justify-center">
                      {savingProject ? (
                        <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                      ) : saveProjectSuccess ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      ) : saveProjectError ? (
                        <AlertCircle className="w-4 h-4 text-red-600" />
                      ) : selectedProject ? (
                        <span className="text-sm font-medium">
                          {projects.find(p => p.id === selectedProject)?.name.charAt(0).toUpperCase()}
                        </span>
                      ) : (
                        <FolderKanban className="w-4 h-4" />
                      )}
                    </div>
                    <div className="ml-2 text-sm font-medium text-gray-700 flex-1 text-left truncate">
                      {selectedProject
                        ? projects.find(p => p.id === selectedProject)?.name
                        : "Select Project"}
                    </div>
                    <ChevronDown className="w-4 h-4 ml-1 flex-shrink-0" />
                  </button>

                  {dropdownsVisible.project && (
                    <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 w-64 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-[9999]">
                      <button
                        type="button"
                        onClick={() => handleProjectChange(null)}
                        className={cn(
                          "w-full px-4 py-2 text-sm text-left hover:bg-gray-50 flex items-center gap-2",
                          !selectedProject && "bg-gray-50 text-gray-700 font-medium"
                        )}
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
                          onClick={() => handleProjectChange(project.id)}
                          className={cn(
                            "w-full px-4 py-2 text-sm text-left hover:bg-gray-50 flex items-center gap-2",
                            selectedProject === project.id && "bg-indigo-50 text-indigo-700 font-medium"
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
            </div>
          </div>

          {/* Assignment */}
          <div className="p-6 bg-white border-b space-y-6">
            <span className="text-xs font-medium text-gray-500 block mb-4">Assignment</span>
            <div className="grid grid-cols-6 gap-10">
              {/* Priority */}
              <div className="flex flex-col items-center col-span-1">
                <span className="text-xs font-medium text-gray-500 mb-2">Priority</span>
                <div className="relative" ref={priorityDropdownRef}>
                  <button
                    type="button"
                    onClick={() => setDropdownsVisible(prev => ({ ...prev, priority: !prev.priority }))}
                    className={cn(
                      "flex items-center justify-center p-1 rounded-full w-10 h-10",
                      localPriority > 0
                        ? "bg-amber-100 text-amber-700 ring-2 ring-amber-200 ring-offset-1 hover:ring-amber-300"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    )}
                  >
                    <div className="w-full h-full rounded-full bg-white flex items-center justify-center text-sm font-medium">
                      {localPriority > 0 ? (
                        <div className="flex -space-x-1">
                          {Array.from({ length: localPriority }).map((_, i) => (
                            <Flame
                              key={i}
                              className="w-3 h-3 fill-current text-amber-500"
                              style={{ transform: `translateX(${i * 1}px)` }}
                            />
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs">None</span>
                      )}
                    </div>
                  </button>
                  {dropdownsVisible.priority && (
                    <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-[9999]">
                      {[
                        { level: 0, label: 'No Priority' },
                        { level: 1, label: 'Low Priority' },
                        { level: 2, label: 'Medium Priority' },
                        { level: 3, label: 'High Priority' },
                      ].map(({ level, label }) => (
                        <button
                          key={level}
                          type="button"
                          onClick={() => handlePriorityChange(level)}
                          className={cn(
                            "w-full px-4 py-2 text-sm text-left hover:bg-gray-50 flex items-center justify-between",
                            localPriority === level && "bg-amber-50 text-amber-700 font-medium"
                          )}
                        >
                          <span>{label}</span>
                          <div className="flex -space-x-1">
                            {level > 0 &&
                              Array.from({ length: level }).map((_, i) => (
                                <Flame
                                  key={i}
                                  className={cn(
                                    "w-3 h-3",
                                    localPriority >= level
                                      ? "fill-current text-amber-500"
                                      : "text-gray-400"
                                  )}
                                  style={{ transform: `translateX(${i * 1}px)` }}
                                />
                              ))}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Responsible */}
              <div className="flex flex-col items-center col-span-1">
                <span className="text-xs font-medium text-gray-500 mb-2">Responsible</span>
                <div className="relative" ref={responsibleDropdownRef}>
                  <button
                    type="button"
                    onClick={() => setDropdownsVisible(prev => ({ ...prev, responsible: !prev.responsible, coworkers: false }))}
                    className={cn(
                      "flex items-center justify-center p-1 rounded-full w-10 h-10",
                      responsible
                        ? "bg-emerald-100 text-emerald-700 ring-2 ring-emerald-200 ring-offset-1 hover:ring-emerald-300"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    )}
                  >
                    <div className="w-full h-full rounded-full bg-white flex items-center justify-center text-sm font-medium">
                      {responsible ? (
                        <span className="text-sm font-medium">
                          {userService
                            .formatUserName(
                              users.find(u => u.id === responsible) || {
                                id: '',
                                email: '',
                                first_name: '',
                                last_name: ''
                              }
                            )
                            .charAt(0)
                            .toUpperCase()}
                        </span>
                      ) : (
                        <User className="w-4 h-4" />
                      )}
                    </div>
                    <ChevronDown className="w-4 h-4 ml-1.5" />
                  </button>

                  {dropdownsVisible.responsible && (
                    <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 w-64 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-[9999] max-h-[240px] overflow-y-auto">
                      {users.map(user => (
                        <button
                          key={user.id}
                          type="button"
                          onClick={() => handleResponsibleChange(user.id)}
                          className={cn(
                            "w-full px-4 py-2 text-sm text-left hover:bg-gray-50 flex items-center justify-between",
                            responsible === user.id && "bg-emerald-50 text-emerald-700 font-medium"
                          )}
                        >
                          <div className="flex items-center">
                            <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center text-sm font-medium text-emerald-700">
                              {userService.formatUserName(user).charAt(0).toUpperCase()}
                            </div>
                            <span className="ml-2">{userService.formatUserName(user)}</span>
                          </div>
                          {responsible === user.id && (
                            <div className="w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center">
                              <svg
                                className="w-3 h-3 text-white"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M5 13l4 4L19 7"
                                />
                              </svg>
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Co-workers */}
              <div className="flex flex-col items-center col-span-4 relative">
                <span className="text-xs font-medium text-gray-500 mb-2">Co-workers</span>
                <div className="flex items-center gap-2">
                  {coworkers.map(userId => (
                    <button
                      key={userId}
                      type="button"
                      onClick={() => handleCoworkerChange(userId)}
                      className="flex items-center p-1 rounded-full bg-indigo-100 text-indigo-700 ring-2 ring-indigo-200 ring-offset-1 hover:ring-indigo-300"
                    >
                      <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-sm font-medium">
                        {userService
                          .formatUserName(
                            users.find(u => u.id === userId) || {
                              id: '',
                              email: '',
                              first_name: '',
                              last_name: ''
                            }
                          )
                          .charAt(0)
                          .toUpperCase()}
                      </div>
                    </button>
                  ))}
                  <div className="relative" ref={coworkerDropdownRef}>
                    <button
                      type="button"
                      onClick={() => setDropdownsVisible(prev => ({ ...prev, coworkers: !prev.coworkers, responsible: false }))}
                      className="flex items-center p-1 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200"
                    >
                      <User className="w-4 h-4" />
                      <ChevronDown className="w-4 h-4 ml-1.5" />
                    </button>

                    {dropdownsVisible.coworkers && (
                      <div className="absolute top-full right-0 mt-1 w-64 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-[9999] max-h-[240px] overflow-y-auto">
                        {users
                          .filter(u => u.id !== responsible)
                          .map(user => {
                            const isSelected = coworkers.includes(user.id);
                            return (
                              <button
                                key={user.id}
                                type="button"
                                onClick={() => handleCoworkerChange(user.id)}
                                className={cn(
                                  "w-full px-4 py-2 text-sm text-left hover:bg-gray-50 flex items-center justify-between",
                                  isSelected && "bg-indigo-50 text-indigo-700 font-medium"
                                )}
                              >
                                <div className="flex items-center">
                                  <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center text-sm font-medium text-indigo-700">
                                    {userService.formatUserName(user).charAt(0).toUpperCase()}
                                  </div>
                                  <span className="ml-2">{userService.formatUserName(user)}</span>
                                </div>
                                {isSelected && (
                                  <div className="w-4 h-4 rounded-full bg-indigo-500 flex items-center justify-center">
                                    <svg
                                      className="w-3 h-3 text-white"
                                      fill="none"
                                      viewBox="0 0 24 24"
                                      stroke="currentColor"
                                    >
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M5 13l4 4L19 7"
                                      />
                                    </svg>
                                  </div>
                                )}
                              </button>
                            );
                          })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Модалка завершення задачі */}
      {showResultModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg max-w-md w-full">
            <h2 className="text-xl font-semibold mb-4">Complete Task</h2>
            <p className="text-gray-600 mb-6">
              Are you sure you want to mark this task as complete?
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowResultModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  // Логіка завершення задачі
                  setShowResultModal(false);
                }}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700"
              >
                Complete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
