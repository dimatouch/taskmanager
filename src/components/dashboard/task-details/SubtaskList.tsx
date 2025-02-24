import { useState, useEffect, useMemo, useRef } from 'react';
import { Plus, Loader2, ChevronRight, ChevronDown, Calendar, User, Flame, Check, Users, ClipboardList } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { cn } from '../../../lib/utils';
import { useNavigate } from 'react-router-dom';
import { useCompany } from '../../../contexts/CompanyContext';
import { QuickTaskModal } from '../QuickTaskModal';
import { DueDatePicker } from '../DueDatePicker';
import type { Task } from '../types';
import { userService } from '../../../services/userService';
import { TaskResultModal } from './components/TaskResultModal';
import { taskActivityService } from '../../../services/taskActivityService';

interface SubtaskListProps {
  parentTask: Task;
  onSubtaskCreated?: () => void;
  isQuickTaskOpen: boolean;
  setIsQuickTaskOpen: (open: boolean) => void;
  statuses: any[];
}

export function SubtaskList({
  parentTask,
  onSubtaskCreated,
  isQuickTaskOpen,
  setIsQuickTaskOpen,
  statuses,
}: SubtaskListProps) {
  const navigate = useNavigate();
  const { currentCompany } = useCompany();

  // Стан для розгортання/згортання списку
  const [isExpanded, setIsExpanded] = useState(true);

  // Стан для підзадач, їх завантаження та можливих помилок
  const [subtasks, setSubtasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Стан для користувачів (відповідальних/співробітників)
  const [users, setUsers] = useState<{ id: string; email: string }[]>([]);

  // Стан для дропдаунів (відповідальний, співробітники, пріоритет, дата тощо)
  const [dropdownsVisible, setDropdownsVisible] = useState<{
    [key: string]: { type: string | null };
  }>({});

  const dropdownRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  // Стан для редагування підзадачі
  const [editingSubtask, setEditingSubtask] = useState<{
    id?: string;
    title: string;
    responsible_id: string | null;
    coworkers: string[];
    due_date: string;
    priority: number;
  } | null>(null);

  // Стан для створення підзадачі
  const [isCreating, setIsCreating] = useState(false);
  const [quickAdd, setQuickAdd] = useState<{
    title: string;
    responsible_id: string | null;
    coworkers: string[];
    due_date: string;
    priority: number;
  }>({
    title: '',
    responsible_id: null,
    coworkers: [],
    due_date: '',
    priority: 0,
  });

  // Стан для модального вікна завершення задачі
  const [showResultModal, setShowResultModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [resultInput, setResultInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [files, setFiles] = useState<File[]>([]);

  // Перевірка, чи батьківське завдання у статусі "Done"
  const isDone = useMemo(() => {
    const doneStatus = statuses.find((s) => s.name === 'Done');
    return doneStatus && parentTask.status_id === doneStatus.id;
  }, [parentTask.status_id, statuses]);

  // Закриття дропдаунів при кліку поза ними
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      Object.entries(dropdownsVisible).forEach(([taskId, dropdown]) => {
        if (dropdown.type) {
          const dropdownRef = dropdownRefs.current[`${taskId}-${dropdown.type}`];
          if (dropdownRef && !dropdownRef.contains(e.target as Node)) {
            setDropdownsVisible((prev) => ({
              ...prev,
              [taskId]: { type: null },
            }));
          }
        }
      });
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [dropdownsVisible]);

  // Завантаження підзадач і користувачів
  useEffect(() => {
    fetchSubtasks();
    fetchUsers();
  }, [parentTask.id]);

  async function fetchUsers() {
    try {
      const fetchedUsers = await userService.getUsers();
      setUsers(fetchedUsers);
    } catch (err) {
      console.error('Failed to fetch users:', err);
    }
  }

  const fetchSubtasks = async () => {
    try {
      setIsLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('parent_id', parentTask.id)
        .eq('is_subtask', true)
        .order('created_at');

      if (error) throw error;
      setSubtasks(data || []);
    } catch (err) {
      if (!(err instanceof Error) || !err.message.includes('Failed to fetch')) {
        console.error('Failed to fetch subtasks:', err instanceof Error ? err.message : 'Unknown error');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Створення підзадачі
  const handleCreateSubtask = async () => {
    if (!quickAdd.title.trim()) return;

    try {
      setIsCreating(true);
      setError(null);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No authenticated user');

      const taskData = {
        title: quickAdd.title.trim(),
        status_id: parentTask.status_id,
        responsible_id: quickAdd.responsible_id,
        due_date: quickAdd.due_date || null,
        priority: quickAdd.priority,
        owner_id: user.id,
        company_id: currentCompany?.id,
        parent_id: parentTask.id,
        position: 0,
        is_subtask: true,
        coworkers: quickAdd.coworkers,
      };

      const { data: newTask, error: createError } = await supabase
        .from('tasks')
        .insert([taskData])
        .select()
        .single();

      if (createError) throw createError;
      if (!newTask) throw new Error('Failed to create subtask');

      // Скидання форми
      setQuickAdd({
        title: '',
        responsible_id: null,
        coworkers: [],
        due_date: '',
        priority: 0,
      });

      // Оновлення списку
      await fetchSubtasks();

      // Сповіщення батьківського компонента
      onSubtaskCreated?.();
    } catch (err) {
      console.error('Failed to create subtask:', err);
      setError(err instanceof Error ? err.message : 'Failed to create subtask');
    } finally {
      setIsCreating(false);
    }
  };

  // Оновлення підзадачі
  const handleUpdateSubtask = async (taskId: string) => {
    if (!editingSubtask) return;

    try {
      const { error: updateError } = await supabase
        .from('tasks')
        .update({
          title: editingSubtask.title.trim(),
          responsible_id: editingSubtask.responsible_id,
          due_date: editingSubtask.due_date || null,
          priority: editingSubtask.priority,
          coworkers: editingSubtask.coworkers,
        })
        .eq('id', taskId);

      if (updateError) throw updateError;

      setEditingSubtask(null);
      await fetchSubtasks();
    } catch (err) {
      console.error('Failed to update subtask:', err);
      setError(err instanceof Error ? err.message : 'Failed to update subtask');
    }
  };

  // Додавання результату і завершення підзадачі
  const handleCompleteTask = async () => {
    if (!selectedTask) return;

    try {
      setIsSubmitting(true);
      const doneStatus = statuses.find((s) => s.name === 'Done');
      if (!doneStatus) return;

      const { error } = await supabase
        .from('tasks')
        .update({
          status_id: doneStatus.id,
          result: resultInput,
        })
        .eq('id', selectedTask.id);

      if (error) throw error;

      // Завантаження файлів, якщо є
      if (files.length > 0) {
        const uploadPromises = files.map(async (file) => {
          const fileExt = file.name.split('.').pop();
          const fileName = `${selectedTask.id}_${Math.random()}.${fileExt}`;
          const { error: uploadError } = await supabase.storage
            .from('task_results')
            .upload(fileName, file);

          if (uploadError) throw uploadError;
        });

        await Promise.all(uploadPromises);
      }

      await fetchSubtasks();
      setShowResultModal(false);
      setSelectedTask(null);
      setResultInput('');
      setFiles([]);
    } catch (err) {
      console.error('Failed to complete task:', err);
      setError(err instanceof Error ? err.message : 'Failed to complete task');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Обробка натискання Enter у полі "title"
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleCreateSubtask();
    }
  };

  // Перемикання видимості дропдаунів
  const handleDropdownToggle = (taskId: string, type: string) => {
    setDropdownsVisible((prev) => ({
      ...prev,
      [taskId]: prev[taskId]?.type === type ? { type: null } : { type },
    }));
  };

  // Зміна відповідального
  const handleResponsibleChange = async (taskId: string, userId: string) => {
    try {
      const task = subtasks.find((t) => t.id === taskId);
      if (!task) return;

      // Якщо новий відповідальний входив у список співробітників — приберемо його з coworkers
      const updatedCoworkers = (task.coworkers || []).filter((id) => id !== userId);

      const { error } = await supabase
        .from('tasks')
        .update({
          responsible_id: userId,
          coworkers: updatedCoworkers,
        })
        .eq('id', taskId);

      if (error) throw error;
      fetchSubtasks();
    } catch (err) {
      console.error('Failed to update responsible:', err);
      setError(err instanceof Error ? err.message : 'Failed to update responsible');
    } finally {
      setDropdownsVisible((prev) => ({ ...prev, [taskId]: { type: null } }));
    }
  };

  // Зміна списку співробітників
  const handleCoworkersChange = async (taskId: string, userId: string) => {
    try {
      const task = subtasks.find((t) => t.id === taskId);
      if (!task) return;

      const newCoworkers = task.coworkers?.includes(userId)
        ? task.coworkers.filter((id) => id !== userId)
        : [...(task.coworkers || []), userId];

      const { error } = await supabase
        .from('tasks')
        .update({ coworkers: newCoworkers })
        .eq('id', taskId);

      if (error) throw error;
      fetchSubtasks();
    } catch (err) {
      console.error('Failed to update coworkers:', err);
      setError(err instanceof Error ? err.message : 'Failed to update coworkers');
    }
  };

  // Зміна пріоритету
  const handlePriorityChange = async (taskId: string, priority: number) => {
    try {
      const { error } = await supabase
        .from('tasks')
        .update({ priority })
        .eq('id', taskId);

      if (error) throw error;
      fetchSubtasks();
    } catch (err) {
      console.error('Failed to update priority:', err);
      setError(err instanceof Error ? err.message : 'Failed to update priority');
    } finally {
      setDropdownsVisible((prev) => ({ ...prev, [taskId]: { type: null } }));
    }
  };

  // Функція для отримання користувача за ID
  const getUser = (id: string) => users.find(user => user.id === id);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className={cn(
              'flex items-center text-sm font-medium transition-colors',
              isExpanded ? 'text-indigo-600' : 'text-gray-700 hover:text-gray-900'
            )}
          >
            {isExpanded ? (
              <ChevronDown className="w-4 h-4 mr-1" />
            ) : (
              <ChevronRight className="w-4 h-4 mr-1" />
            )}
            <span className="flex items-center gap-2">
              Subtasks
              {subtasks.length > 0 && (
                <span className="px-2 py-0.5 text-xs rounded-full bg-indigo-100 text-indigo-600">
                  {subtasks.length}
                </span>
              )}
            </span>
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="mt-4">
          <div className="space-y-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
              </div>
            ) : (
              <div className="space-y-2">
                {subtasks.length > 0 && subtasks.map((subtask) => (
                  <div
                    key={subtask.id}
                    className="flex items-center gap-4 p-2 rounded-lg hover:bg-gray-50 group relative"
                  >
                    <div className="flex-1 flex items-center gap-4 min-w-0">
                      {/* Кнопка для швидкого завершення підзадачі */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowResultModal(true);
                          setSelectedTask(subtask);
                        }}
                        className={cn(
                          'p-1.5 rounded-lg transition-colors',
                          subtask.result
                            ? 'bg-emerald-100 text-emerald-600 hover:bg-emerald-200'
                            : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                        )}
                      >
                        {subtask.result ? (
                          <div className="w-4 h-4 rounded bg-emerald-600 text-white flex items-center justify-center">
                            <Check className="w-3 h-3" />
                          </div>
                        ) : (
                          <div className="w-4 h-4 rounded border-2 border-gray-400" />
                        )}
                      </button>

                      {editingSubtask?.id === subtask.id ? (
                        <input
                          type="text"
                          value={editingSubtask.title}
                          onChange={(e) =>
                            setEditingSubtask((prev) =>
                              prev ? { ...prev, title: e.target.value } : null
                            )
                          }
                          onKeyDown={handleKeyDown}
                          className={cn(
                            'flex-1 px-2 py-1 text-sm rounded border',
                            'focus:outline-none focus:ring-2 focus:ring-indigo-500/10',
                            'bg-white'
                          )}
                          autoFocus
                        />
                      ) : (
                        <span
                          className="text-sm text-gray-700 cursor-pointer hover:text-indigo-600 flex-1"
                          onClick={() => {
                            if (currentCompany) {
                              navigate(`/${currentCompany.id}/tasks/${subtask.id}`);
                            }
                          }}
                        >
                          {subtask.title}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {/* Відповідальний */}
                      <div className="relative">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDropdownToggle(subtask.id, 'responsible');
                          }}
                          className="flex items-center"
                        >
                          <div
                            className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center text-xs font-medium text-emerald-700"
                            title={userService.formatUserName(
                              users.find((u) => u.id === subtask.responsible_id) || {
                                id: '',
                                email: 'Unknown',
                              }
                            )}
                          >
                            {subtask.responsible_id ? (
                              (users.find((u) => u.id === subtask.responsible_id)?.email ||
                                'U')[0].toUpperCase()
                            ) : (
                              <User className="w-3 h-3" />
                            )}
                          </div>
                        </button>

                        {dropdownsVisible[subtask.id]?.type === 'responsible' && (
                          <div
                            ref={(el) =>
                              (dropdownRefs.current[`${subtask.id}-responsible`] = el)
                            }
                            className="absolute top-full left-0 mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50"
                          >
                            {users.map((user) => (
                              <button
                                key={user.id}
                                onClick={() => handleResponsibleChange(subtask.id, user.id)}
                                className={cn(
                                  'w-full px-3 py-1.5 text-sm text-left hover:bg-gray-50 flex items-center',
                                  subtask.responsible_id === user.id &&
                                    'bg-emerald-50 text-emerald-700'
                                )}
                              >
                                <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center mr-2">
                                  <span className="text-xs font-medium text-emerald-700">
                                    {user.email.charAt(0).toUpperCase()}
                                  </span>
                                </div>
                                <span>{userService.formatUserName(user)}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Співробітники */}
                      <div className="relative">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDropdownToggle(subtask.id, 'coworkers');
                          }}
                          className="flex items-center -space-x-1"
                        >
                          {(subtask.coworkers || []).length > 0 ? (
                            <>
                              {(subtask.coworkers || []).slice(0, 3).map((coworkerId) => (
                                <div
                                  key={coworkerId}
                                  className="w-6 h-6 rounded-full bg-indigo-100 border-2 border-white flex items-center justify-center text-xs font-medium text-indigo-700"
                                  title={userService.formatUserName(
                                    users.find((u) => u.id === coworkerId) || {
                                      id: '',
                                      email: 'Unknown',
                                    }
                                  )}
                                >
                                  {(
                                    users.find((u) => u.id === coworkerId)?.email || 'U'
                                  )[0].toUpperCase()}
                                </div>
                              ))}
                              {(subtask.coworkers || []).length > 3 && (
                                <div className="w-6 h-6 rounded-full bg-gray-100 border-2 border-white flex items-center justify-center text-xs font-medium text-gray-600">
                                  +{subtask.coworkers.length - 3}
                                </div>
                              )}
                            </>
                          ) : (
                            <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center">
                              <User className="w-3 h-3 text-gray-400" />
                            </div>
                          )}
                        </button>

                        {dropdownsVisible[subtask.id]?.type === 'coworkers' && (
                          <div
                            ref={(el) =>
                              (dropdownRefs.current[`${subtask.id}-coworkers`] = el)
                            }
                            className="absolute top-full left-0 mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50"
                          >
                            {users.map((user) => (
                              <button
                                key={user.id}
                                onClick={() => handleCoworkersChange(subtask.id, user.id)}
                                className={cn(
                                  'w-full px-3 py-1.5 text-sm text-left hover:bg-gray-50 flex items-center justify-between',
                                  subtask.coworkers?.includes(user.id) &&
                                    'bg-indigo-50 text-indigo-700',
                                  user.id === subtask.responsible_id &&
                                    'opacity-50 cursor-not-allowed'
                                )}
                                disabled={user.id === subtask.responsible_id}
                              >
                                <div className="flex items-center">
                                  <div className="w-5 h-5 rounded-full bg-indigo-100 flex items-center justify-center mr-2">
                                    <span className="text-xs font-medium text-indigo-700">
                                      {user.email.charAt(0).toUpperCase()}
                                    </span>
                                  </div>
                                  <span>{userService.formatUserName(user)}</span>
                                </div>
                                {subtask.coworkers?.includes(user.id) && (
                                  <Check className="w-4 h-4" />
                                )}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Пріоритет */}
                      <div className="relative">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDropdownToggle(subtask.id, 'priority');
                          }}
                          className="flex items-center"
                        >
                          {subtask.priority > 0 ? (
                            Array.from({ length: subtask.priority }).map((_, i) => (
                              <Flame
                                key={i}
                                className="w-4 h-4 text-amber-500 fill-current"
                                style={{ transform: `translateX(${i * 2}px)` }}
                              />
                            ))
                          ) : (
                            <Flame className="w-4 h-4 text-gray-400" />
                          )}
                        </button>

                        {dropdownsVisible[subtask.id]?.type === 'priority' && (
                          <div
                            ref={(el) =>
                              (dropdownRefs.current[`${subtask.id}-priority`] = el)
                            }
                            className="absolute top-full right-0 mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50"
                          >
                            {[0, 1, 2, 3].map((level) => (
                              <button
                                key={level}
                                onClick={() => handlePriorityChange(subtask.id, level)}
                                className={cn(
                                  'w-full px-3 py-1.5 text-sm text-left hover:bg-gray-50 flex items-center justify-between',
                                  subtask.priority === level && 'bg-amber-50 text-amber-600'
                                )}
                              >
                                <span>{level === 0 ? 'No Priority' : `Priority ${level}`}</span>
                                {level > 0 && (
                                  <div className="flex -space-x-1">
                                    {Array.from({ length: level }).map((_, i) => (
                                      <Flame
                                        key={i}
                                        className={cn(
                                          'w-3.5 h-3.5',
                                          subtask.priority === level && 'fill-current'
                                        )}
                                      />
                                    ))}
                                  </div>
                                )}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Дата виконання */}
                      <div className="relative">
                        <DueDatePicker
                          selectedDate={subtask.due_date || ''}
                          onChange={async (date) => {
                            try {
                              const { error } = await supabase
                                .from('tasks')
                                .update({ 
                                  due_date: date || null,
                                  updated_at: new Date().toISOString()
                                })
                                .eq('id', subtask.id);

                              if (error) throw error;

                              await taskActivityService.logActivity({
                                taskId: subtask.id,
                                field: 'due_date',
                                oldValue: subtask.due_date || '',
                                newValue: date || '',
                                type: 'update'
                              });

                              fetchSubtasks();
                            } catch (err) {
                              console.error('Failed to update due date:', err);
                              setError(err instanceof Error ? err.message : 'Failed to update due date');
                            }
                          }}
                          variant="transparent"
                        />
                      </div>
                    </div>
                  </div>
                ))}
                
                {/* Quick Add Form */}
                <div className="flex items-center gap-2 p-2 rounded-lg border border-gray-100 relative">
                  <input
                    type="text"
                    placeholder="Add new subtask (required)"
                    className="flex-1 text-sm outline-none"
                    value={quickAdd.title}
                    onChange={(e) => setQuickAdd(prev => ({ ...prev, title: e.target.value }))}
                  />
                  
                  <div className="flex items-center gap-2">
                    {/* Responsible */}
                    <div className="relative">
                      <button 
                        className={cn(
                          "p-1.5 rounded hover:bg-gray-50 flex items-center gap-1",
                          quickAdd.responsible_id && "text-blue-500 bg-blue-50 hover:bg-blue-50/80"
                        )}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDropdownToggle('quickAdd', 'responsible');
                        }}
                      >
                        {quickAdd.responsible_id ? (
                          <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center">
                            <span className="text-xs font-medium">
                              {getUser(quickAdd.responsible_id)?.email.charAt(0).toUpperCase()}
                            </span>
                          </div>
                        ) : (
                          <User className="w-3.5 h-3.5 text-gray-400" />
                        )}
                      </button>
                      {dropdownsVisible['quickAdd']?.type === 'responsible' && (
                        <div 
                          ref={(el) => (dropdownRefs.current['quickAdd-responsible'] = el)}
                          className="absolute top-full right-0 mt-1 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50"
                        >
                          {users.map((user) => (
                            <button
                              key={user.id}
                              onClick={() => {
                                setQuickAdd(prev => ({ ...prev, responsible_id: user.id }));
                                handleDropdownToggle('quickAdd', 'responsible');
                              }}
                              className="w-full px-4 py-2 text-sm text-left hover:bg-gray-50 flex items-center gap-2"
                            >
                              <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                                <span className="text-xs font-medium">{user.email.charAt(0).toUpperCase()}</span>
                              </div>
                              <span className="truncate">{user.email}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Coworkers */}
                    <div className="relative">
                      <button 
                        className={cn(
                          "p-1.5 rounded hover:bg-gray-50 flex items-center gap-1",
                          quickAdd.coworkers.length > 0 && "text-purple-500 bg-purple-50 hover:bg-purple-50/80"
                        )}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDropdownToggle('quickAdd', 'coworkers');
                        }}
                      >
                        {quickAdd.coworkers.length > 0 ? (
                          <div className="flex -space-x-1">
                            {quickAdd.coworkers.slice(0, 2).map((id) => (
                              <div key={id} className="w-5 h-5 rounded-full bg-purple-100 flex items-center justify-center">
                                <span className="text-xs font-medium">
                                  {getUser(id)?.email.charAt(0).toUpperCase()}
                                </span>
                              </div>
                            ))}
                            {quickAdd.coworkers.length > 2 && (
                              <div className="w-5 h-5 rounded-full bg-purple-100 flex items-center justify-center">
                                <span className="text-xs font-medium">+{quickAdd.coworkers.length - 2}</span>
                              </div>
                            )}
                          </div>
                        ) : (
                          <Users className="w-3.5 h-3.5 text-gray-400" />
                        )}
                      </button>
                      {dropdownsVisible['quickAdd']?.type === 'coworkers' && (
                        <div 
                          ref={(el) => (dropdownRefs.current['quickAdd-coworkers'] = el)}
                          className="absolute top-full right-0 mt-1 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50"
                        >
                          {users.map((user) => (
                            <button
                              key={user.id}
                              onClick={() => {
                                const newCoworkers = quickAdd.coworkers.includes(user.id)
                                  ? quickAdd.coworkers.filter(id => id !== user.id)
                                  : [...quickAdd.coworkers, user.id];
                                setQuickAdd(prev => ({ ...prev, coworkers: newCoworkers }));
                              }}
                              className="w-full px-4 py-2 text-sm text-left hover:bg-gray-50 flex items-center gap-2"
                            >
                              <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                                <span className="text-xs font-medium">{user.email.charAt(0).toUpperCase()}</span>
                              </div>
                              <span className="truncate flex-1">{user.email}</span>
                              {quickAdd.coworkers.includes(user.id) && (
                                <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Due Date */}
                    <div className="relative">
                      <button 
                        className={cn(
                          "p-1.5 rounded hover:bg-gray-50 flex items-center gap-1",
                          quickAdd.due_date && "text-green-500 bg-green-50 hover:bg-green-50/80"
                        )}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDropdownToggle('quickAdd', 'dueDate');
                        }}
                      >
                        {quickAdd.due_date ? (
                          <div className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5" />
                            <span className="text-xs">{new Date(quickAdd.due_date).toLocaleDateString()}</span>
                          </div>
                        ) : (
                          <Calendar className="w-3.5 h-3.5 text-gray-400" />
                        )}
                      </button>
                      {dropdownsVisible['quickAdd']?.type === 'dueDate' && (
                        <div 
                          ref={(el) => (dropdownRefs.current['quickAdd-dueDate'] = el)}
                          className="absolute bottom-full right-0 mb-1 z-50 bg-white rounded-lg shadow-lg border border-gray-200"
                          style={{ width: '280px' }}
                        >
                          <DueDatePicker
                            selectedDate={quickAdd.due_date}
                            onChange={(date) => {
                              setQuickAdd(prev => ({ ...prev, due_date: date }));
                              handleDropdownToggle('quickAdd', 'dueDate');
                            }}
                            showNoDateButton={false}
                            showQuickButtons={true}
                            initialView="calendar"
                          />
                        </div>
                      )}
                    </div>

                    {/* Priority */}
                    <div className="relative">
                      <button 
                        className={cn(
                          "p-1.5 rounded hover:bg-gray-50 flex items-center gap-1",
                          quickAdd.priority > 0 && "text-amber-500 bg-amber-50 hover:bg-amber-50/80"
                        )}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDropdownToggle('quickAdd', 'priority');
                        }}
                      >
                        {quickAdd.priority > 0 ? (
                          <div className="flex -space-x-0.5">
                            {Array.from({ length: quickAdd.priority }).map((_, i) => (
                              <Flame key={i} className="w-3.5 h-3.5" />
                            ))}
                          </div>
                        ) : (
                          <Flame className="w-3.5 h-3.5 text-gray-400" />
                        )}
                      </button>
                      {dropdownsVisible['quickAdd']?.type === 'priority' && (
                        <div 
                          ref={(el) => (dropdownRefs.current['quickAdd-priority'] = el)}
                          className="absolute top-full right-0 mt-1 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50"
                        >
                          {[0, 1, 2, 3].map((level) => (
                            <button
                              key={level}
                              onClick={() => {
                                setQuickAdd(prev => ({ ...prev, priority: level }));
                                handleDropdownToggle('quickAdd', 'priority');
                              }}
                              className="w-full px-4 py-2 text-sm text-left hover:bg-gray-50 flex items-center justify-between"
                            >
                              <span>{level === 0 ? 'No Priority' : `Priority ${level}`}</span>
                              {level > 0 && (
                                <div className="flex gap-0.5">
                                  {Array.from({ length: level }).map((_, i) => (
                                    <Flame
                                      key={i}
                                      className="w-3.5 h-3.5 text-amber-500"
                                    />
                                  ))}
                                </div>
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Save Button */}
                    <button 
                      className={cn(
                        "p-1.5 rounded transition-all duration-200 ease-in-out",
                        quickAdd.title.trim()
                          ? "bg-indigo-50 hover:bg-indigo-100 transform hover:scale-105"
                          : "bg-gray-50 cursor-not-allowed opacity-50"
                      )}
                      onClick={handleCreateSubtask}
                      disabled={!quickAdd.title.trim()}
                    >
                      <Check 
                        className={cn(
                          "w-3.5 h-3.5 transition-all duration-200",
                          quickAdd.title.trim()
                            ? "text-indigo-600"
                            : "text-gray-400"
                        )}
                      />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Модальне вікно для заповнення результату підзадачі */}
      {showResultModal && selectedTask && (
        <TaskResultModal
          isOpen={showResultModal}
          task={selectedTask}
          resultInput={resultInput}
          onClose={() => {
            setShowResultModal(false);
            setSelectedTask(null);
            setResultInput('');
            setFiles([]);
          }}
          onResultChange={(e) => setResultInput(e.target.value)}
          onComplete={handleCompleteTask}
          isSubmitting={isSubmitting}
          error={error}
          files={files}
          onFileChange={setFiles}
        />
      )}

      {/* Модальне вікно для швидкого створення завдання */}
      {isQuickTaskOpen && (
        <QuickTaskModal
          isOpen={isQuickTaskOpen}
          onClose={() => setIsQuickTaskOpen(false)}
          parentTask={parentTask}
          onSubtaskCreated={onSubtaskCreated}
        />
      )}
    </div>
  );
}
