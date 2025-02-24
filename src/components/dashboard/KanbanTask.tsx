import { useState, useRef, useEffect, useCallback } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Calendar, User, Flame, Users, Pencil, Check, X } from 'lucide-react';
import type { Task } from './types';
import { cn } from '../../lib/utils';
import { useNavigate, useLocation } from 'react-router-dom';
import { useCompany } from '../../contexts/CompanyContext';
import { userService } from '../../services/userService';
import { supabase } from '../../lib/supabase';
import { DueDatePicker } from './DueDatePicker';

interface KanbanTaskProps {
  task: Task;
  users: { id: string; email: string }[];
  onClick?: () => void;
}

export function KanbanTask({ task, users = [], onClick }: KanbanTaskProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentCompany } = useCompany();

  // Використовуємо локальний стан для задачі для оптимістичного оновлення
  const [localTask, setLocalTask] = useState<Task>(task);
  useEffect(() => {
    setLocalTask(task);
  }, [task]);

  const [isEditing, setIsEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState(localTask.title);
  const [showResponsibleDropdown, setShowResponsibleDropdown] = useState(false);
  const [showCoworkersDropdown, setShowCoworkersDropdown] = useState(false);
  const [showDueDatePicker, setShowDueDatePicker] = useState(false);
  const [showPriorityDropdown, setShowPriorityDropdown] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const dropdownRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  // Реф для кнопки, що відкриває календар
  const dueDateButtonRef = useRef<HTMLButtonElement>(null);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: localTask.id,
    data: { type: 'task', task: localTask },
  });

  // Закриття dropdown'ів при кліку поза ними (якщо клік не відбувається на тригері)
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (dueDateButtonRef.current && dueDateButtonRef.current.contains(target)) return;
      if (
        showResponsibleDropdown &&
        dropdownRefs.current.responsible &&
        !dropdownRefs.current.responsible.contains(target) &&
        !target.closest('[data-dropdown="responsible"]')
      ) {
        setShowResponsibleDropdown(false);
      }
      if (
        showCoworkersDropdown &&
        dropdownRefs.current.coworkers &&
        !dropdownRefs.current.coworkers.contains(target) &&
        !target.closest('[data-dropdown="coworkers"]')
      ) {
        setShowCoworkersDropdown(false);
      }
      if (
        showPriorityDropdown &&
        dropdownRefs.current.priority &&
        !dropdownRefs.current.priority.contains(target) &&
        !target.closest('[data-dropdown="priority"]')
      ) {
        setShowPriorityDropdown(false);
      }
      if (
        showDueDatePicker &&
        dropdownRefs.current.dueDate &&
        !dropdownRefs.current.dueDate.contains(target) &&
        !target.closest('[data-dropdown="dueDate"]')
      ) {
        setShowDueDatePicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showResponsibleDropdown, showCoworkersDropdown, showPriorityDropdown, showDueDatePicker]);

  const handleTaskClick = () => {
    const searchParams = new URLSearchParams(location.search);
    const currentView = searchParams.get('view') || 'kanban';
    navigate(`/${currentCompany?.id}/tasks/${localTask.id}`, {
      state: {
        background: location,
        returnTo: `/${currentCompany?.id}/tasks?view=${currentView}`,
        fromKanban: true,
      },
    });
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      setError(null);
      const newTitle = editedTitle.trim();
      const { error } = await supabase
        .from('tasks')
        .update({ title: newTitle })
        .eq('id', localTask.id);
      if (error) throw error;
      setLocalTask((prev) => ({ ...prev, title: newTitle }));
      setIsEditing(false);
    } catch (err) {
      console.error('Failed to update task:', err);
      setError(err instanceof Error ? err.message : 'Failed to update task');
    } finally {
      setIsSaving(false);
    }
  };

  const handleResponsibleChange = async (userId: string) => {
    try {
      setIsSaving(true);
      setError(null);
      const newTask = {
        ...localTask,
        responsible_id: userId,
        coworkers: localTask.coworkers?.filter((id) => id !== userId) || [],
      };
      setLocalTask(newTask);
      const { error } = await supabase.from('tasks').update(newTask).eq('id', localTask.id);
      if (error) throw error;
      setShowResponsibleDropdown(false);
    } catch (err) {
      console.error('Failed to update responsible:', err);
      setError(err instanceof Error ? err.message : 'Failed to update responsible');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCoworkerChange = async (userId: string) => {
    try {
      setIsSaving(true);
      setError(null);
      let newCoworkers: string[];
      if (localTask.coworkers?.includes(userId)) {
        newCoworkers = localTask.coworkers.filter((id) => id !== userId);
      } else {
        newCoworkers = [...(localTask.coworkers || []), userId];
      }
      setLocalTask((prev) => ({ ...prev, coworkers: newCoworkers }));
      const { error } = await supabase.from('tasks').update({ coworkers: newCoworkers }).eq('id', localTask.id);
      if (error) throw error;
    } catch (err) {
      console.error('Failed to update coworkers:', err);
      setError(err instanceof Error ? err.message : 'Failed to update coworkers');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePriorityChange = async (priority: number) => {
    try {
      setIsSaving(true);
      setError(null);
      setLocalTask((prev) => ({ ...prev, priority }));
      const { error } = await supabase.from('tasks').update({ priority }).eq('id', localTask.id);
      if (error) throw error;
    } catch (err) {
      console.error('Failed to update priority:', err);
      setError(err instanceof Error ? err.message : 'Failed to update priority');
    } finally {
      setIsSaving(false);
      setShowPriorityDropdown(false);
    }
  };

  const handleDueDateChange = async (date: string) => {
    try {
      setIsSaving(true);
      setError(null);
      setLocalTask((prev) => ({ ...prev, due_date: date }));
      const { error } = await supabase.from('tasks').update({ due_date: date }).eq('id', localTask.id);
      if (error) throw error;
      setShowDueDatePicker(false);
    } catch (err) {
      console.error('Failed to update due date:', err);
      setError(err instanceof Error ? err.message : 'Failed to update due date');
    } finally {
      setIsSaving(false);
    }
  };

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const isOverdue =
    localTask.due_date && new Date(localTask.due_date) < new Date() && !localTask.result;

  const responsible = localTask.responsible_id
    ? users.find((u) => u.id === localTask.responsible_id)
    : null;

  const coworkers = (localTask.coworkers || [])
    .map((id) => users.find((u) => u.id === id))
    .filter(Boolean);

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={handleTaskClick}
      className={cn(
        "bg-white rounded-lg border shadow-sm hover:shadow-md transition-all p-3",
        "cursor-grab active:cursor-grabbing",
        "hover:border-indigo-200 group",
        isDragging && "opacity-50",
        isOverdue && "border-red-200 bg-red-50/30"
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        {isEditing ? (
          <div className="flex-1">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleSave();
              }}
              className="flex-1"
              onClick={(e) => e.stopPropagation()}
            >
              <input
                ref={titleInputRef}
                type="text"
                value={editedTitle}
                onChange={(e) => setEditedTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSave();
                  } else if (e.key === 'Escape') {
                    setIsEditing(false);
                    setEditedTitle(localTask.title);
                  }
                }}
                className={cn(
                  "w-full text-sm font-medium bg-white border rounded px-2 py-1",
                  "focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500",
                  "placeholder:text-gray-400"
                )}
                autoFocus
              />
              <div className="flex items-center gap-1 mt-1">
                <button
                  type="submit"
                  disabled={isSaving || !editedTitle.trim()}
                  className={cn(
                    "p-1 rounded text-xs",
                    "bg-emerald-50 text-emerald-600 hover:bg-emerald-100",
                    "disabled:opacity-50 disabled:cursor-not-allowed"
                  )}
                >
                  <Check className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsEditing(false);
                    setEditedTitle(localTask.title);
                  }}
                  className="p-1 rounded text-xs bg-gray-50 text-gray-600 hover:bg-gray-100"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            </form>
          </div>
        ) : (
          <div className="flex-1 group/title relative min-w-0">
            <h3 className="text-sm font-medium text-gray-900 line-clamp-2 group-hover:text-indigo-600">
              {localTask.title}
            </h3>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsEditing(true);
              }}
              className={cn(
                "absolute right-0 top-0 p-1 rounded",
                "opacity-0 group-hover/title:opacity-100 transition-opacity",
                "text-gray-400 hover:text-gray-600 hover:bg-gray-100"
              )}
            >
              <Pencil className="w-3 h-3" />
            </button>
          </div>
        )}
        <div className="relative flex-shrink-0">
          <button
            data-dropdown="priority"
            onClick={(e) => {
              e.stopPropagation();
              setShowPriorityDropdown(!showPriorityDropdown);
            }}
            className={cn(
              "p-1 rounded transition-colors",
              localTask.priority > 0
                ? "bg-amber-100 text-amber-700 hover:bg-amber-200"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            )}
          >
            {localTask.priority > 0 ? (
              <div className="flex -space-x-1">
                {Array.from({ length: localTask.priority }).map((_, i) => (
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
          {showPriorityDropdown && (
            <div
              ref={(el) => (dropdownRefs.current.priority = el)}
              className="absolute top-full right-0 mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50"
              onClick={(e) => e.stopPropagation()}
            >
              {[0, 1, 2, 3].map((level) => (
                <button
                  key={level}
                  onClick={() => {
                    handlePriorityChange(level);
                    setShowPriorityDropdown(false);
                  }}
                  className={cn(
                    "w-full px-3 py-1.5 text-sm text-left hover:bg-gray-50 flex items-center justify-between",
                    localTask.priority === level && "bg-amber-50 text-amber-700"
                  )}
                >
                  <span>{level === 0 ? 'No Priority' : `Priority ${level}`}</span>
                  {level > 0 && (
                    <div className="flex -space-x-1">
                      {Array.from({ length: level }).map((_, i) => (
                        <Flame
                          key={i}
                          className={cn("w-3.5 h-3.5", localTask.priority === level && "fill-current")}
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

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <div className="relative">
            <button
              type="button"
              data-dropdown="responsible"
              onClick={(e) => {
                e.stopPropagation();
                setShowResponsibleDropdown(!showResponsibleDropdown);
                setShowCoworkersDropdown(false);
              }}
              className={cn(
                "flex items-center p-1 rounded-full transition-colors",
                responsible
                  ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              )}
            >
              <div className="w-6 h-6 rounded-full bg-white flex items-center justify-center">
                {responsible ? (
                  <span className="text-[10px] font-medium">
                    {responsible.email.charAt(0).toUpperCase()}
                  </span>
                ) : (
                  <User className="w-3 h-3" />
                )}
              </div>
            </button>
            {showResponsibleDropdown && (
              <div
                ref={(el) => (dropdownRefs.current.responsible = el)}
                className="absolute top-full left-0 mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50"
                onClick={(e) => e.stopPropagation()}
              >
                {users.map((user) => (
                  <button
                    key={user.id}
                    onClick={() => handleResponsibleChange(user.id)}
                    className={cn(
                      "w-full px-3 py-1.5 text-sm text-left hover:bg-gray-50 flex items-center gap-2",
                      responsible?.id === user.id && "bg-emerald-50 text-emerald-700"
                    )}
                  >
                    <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center mr-2">
                      <span className="text-xs font-medium text-emerald-700">
                        {user.email.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <span className="truncate">{userService.formatUserName(user)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="relative">
            <button
              type="button"
              data-dropdown="coworkers"
              onClick={(e) => {
                e.stopPropagation();
                setShowCoworkersDropdown(!showCoworkersDropdown);
                setShowResponsibleDropdown(false);
              }}
              className={cn(
                "flex items-center p-1 rounded-full transition-colors",
                coworkers.length > 0
                  ? "bg-indigo-100 text-indigo-700 hover:bg-indigo-200"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              )}
            >
              <div className="flex -space-x-1">
                {coworkers.length > 0 ? (
                  coworkers.slice(0, 2).map((user, index) => (
                    <div
                      key={user.id}
                      className="w-6 h-6 rounded-full bg-indigo-100 ring-2 ring-white flex items-center justify-center"
                    >
                      <span className="text-[10px] font-medium text-indigo-700">
                        {user.email.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="w-6 h-6 rounded-full bg-white flex items-center justify-center">
                    <Users className="w-3 h-3" />
                  </div>
                )}
                {coworkers.length > 2 && (
                  <div className="w-6 h-6 rounded-full bg-indigo-50 ring-2 ring-white flex items-center justify-center">
                    <span className="text-[10px] font-medium text-indigo-600">
                      +{coworkers.length - 2}
                    </span>
                  </div>
                )}
              </div>
            </button>
            {showCoworkersDropdown && (
              <div
                ref={(el) => (dropdownRefs.current.coworkers = el)}
                className="absolute top-full left-0 mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50"
                onClick={(e) => e.stopPropagation()}
              >
                {users.map((user) => (
                  <button
                    key={user.id}
                    onClick={() => handleCoworkerChange(user.id)}
                    disabled={user.id === localTask.responsible_id}
                    className={cn(
                      "w-full px-3 py-1.5 text-sm text-left hover:bg-gray-50 flex items-center justify-between",
                      coworkers.some((c) => c.id === user.id) && "bg-indigo-50 text-indigo-700",
                      user.id === localTask.responsible_id && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    <div className="flex items-center">
                      <div className="w-5 h-5 rounded-full bg-indigo-100 flex items-center justify-center mr-2">
                        <span className="text-xs font-medium text-indigo-700">
                          {user.email.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <span className="truncate">{userService.formatUserName(user)}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="relative">
            <div onClick={(e) => e.stopPropagation()}>
              <DueDatePicker
                selectedDate={localTask.due_date || ''}
                onChange={handleDueDateChange}
                variant="transparent"
              />
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="mt-2 text-xs text-red-600 bg-red-50 p-1 rounded">
          {error}
        </div>
      )}
    </div>
  );
}
