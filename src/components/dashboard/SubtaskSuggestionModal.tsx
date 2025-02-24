import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, X, AlertCircle, Wand2, ChevronRight, Calendar, User, Users, Check, Flame, Pencil } from 'lucide-react';
import { cn } from '../../lib/utils';
import { subtaskAssistantService } from '../../services/subtaskAssistantService';
import { supabase } from '../../lib/supabase';
import { taskActivityService } from '../../services/taskActivityService';
import { userService } from '../../services/userService';
import { QuickTaskModal } from './QuickTaskModal';
import { DueDatePicker } from './DueDatePicker';

interface SubtaskSuggestion {
  title: string;
  description: string | null;
  priority: number;
  selected?: boolean;
}

interface SubtaskSuggestionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  task?: {
    id?: string;
    title: string;
    description: string | null;
  };
  statuses: any[];
  users: any[];
  parentTaskId?: string;
  companyId?: string;
}

export function SubtaskSuggestionModal({
  isOpen,
  onClose,
  onSuccess,
  task,
  statuses = [],
  users = [],
  parentTaskId,
  companyId
}: SubtaskSuggestionModalProps) {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<SubtaskSuggestion[]>([]);
  const [isCreatingTasks, setIsCreatingTasks] = useState(false);
  const [selectedCount, setSelectedCount] = useState(0);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editedTitle, setEditedTitle] = useState('');
  const [editedDescription, setEditedDescription] = useState('');
  const [selectedDates, setSelectedDates] = useState<Record<number, string>>({});
  const [selectedResponsible, setSelectedResponsible] = useState<Record<number, string>>({});
  const [selectedCoworkers, setSelectedCoworkers] = useState<Record<number, string[]>>({});
  const [selectedPriorities, setSelectedPriorities] = useState<Record<number, number>>({});
  const [dropdownOpen, setDropdownOpen] = useState<{
    index: number;
    type: 'date' | 'responsible' | 'coworkers' | 'priority' | null;
  }>({ index: -1, type: null });
  const dropdownRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
  const buttonRefs = useRef<{ [key: string]: HTMLButtonElement | null }>({});

  const handleDateChange = (date: string, index: number) => {    
    setSelectedDates(prev => ({ ...prev, [index]: date }));
    setDropdownOpen({ index: -1, type: null });
    // Prevent event bubbling
    return false;
  };

  const handleResponsibleChange = async (e: React.MouseEvent, userId: string, index: number) => {
    e.stopPropagation();
    e.preventDefault();

    setSelectedResponsible(prev => ({ ...prev, [index]: userId }));
    
    // Remove user from coworkers if they become responsible
    setSelectedCoworkers(prev => ({
      ...prev,
      [index]: (prev[index] || []).filter(id => id !== userId)
    }));

    setDropdownOpen({ index: -1, type: null });
    // Prevent event bubbling
    return false;
  };

  const handleCoworkerChange = async (e: React.MouseEvent, userId: string, index: number) => {
    e.stopPropagation();
    e.preventDefault();
    
    const currentCoworkers = selectedCoworkers[index] || [];
    
    // Don't allow selecting responsible user as coworker
    if (userId === selectedResponsible[index]) {
      return;
    }

    // Toggle coworker selection
    const newCoworkers = currentCoworkers.includes(userId)
      ? currentCoworkers.filter(id => id !== userId)
      : [...currentCoworkers, userId];
    
    setSelectedCoworkers(prev => ({
      ...prev,
      [index]: newCoworkers
    }));
  };

  const handlePriorityChange = async (e: React.MouseEvent, priority: number, index: number) => {
    e.stopPropagation();
    e.preventDefault();

    setSelectedPriorities(prev => ({ ...prev, [index]: priority }));
    setDropdownOpen({ index: -1, type: null });
  };

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownOpen.type) {
        const target = e.target as HTMLElement;
        const dropdownKey = `${dropdownOpen.index}-${dropdownOpen.type}`;
        const buttonKey = `button-${dropdownKey}`;
        
        // Check if click is inside dropdown or its trigger button
        if (!dropdownRefs.current[dropdownKey]?.contains(target) && 
            !buttonRefs.current[buttonKey]?.contains(target)) {
          setDropdownOpen({ index: -1, type: null });
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    
    // Cleanup function
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [dropdownOpen]);

  const handleGetSuggestions = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      if (!task?.title) {
        throw new Error('Task title is required');
      }

      const suggestions = await subtaskAssistantService.suggestSubtasks(
        task.title,
        task.description
      );

      setSuggestions((suggestions || []).map(s => ({ ...s, selected: true })));
      setSelectedCount(suggestions?.length || 0);
    } catch (err) {
      console.error('Failed to get suggestions:', err);
      setError(err instanceof Error ? err.message : 'Failed to get suggestions');
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleSubtask = (index: number) => {
    setSuggestions(prev => prev.map((s, i) => {
      if (i === index) {
        const newSelected = !s.selected;
        setSelectedCount(prev => newSelected ? prev + 1 : prev - 1);
        return { ...s, selected: newSelected };
      }
      return s;
    }));
  };

  const handleStartEdit = (index: number, title: string, description: string | null) => {
    setEditingIndex(index);
    setEditedTitle(title);
    setEditedDescription(description || '');
  };

  const handleSaveEdit = (index: number) => {
    if (editedTitle.trim()) {
      setSuggestions(prev => prev.map((s, i) => 
        i === index ? { 
          ...s, 
          title: editedTitle.trim(),
          description: editedDescription.trim() || null
        } : s
      ));
    }
    setEditingIndex(null);
    setEditedTitle('');
    setEditedDescription('');
  };

  const handleCreateSubtasks = async () => {
    try {
      setIsCreatingTasks(true);
      setError(null);

      // Get the highest position for existing tasks
      const { data: existingTasks } = await supabase
        .from('tasks')
        .select('position')
        .order('position', { ascending: false })
        .limit(1);

      const nextPosition = (existingTasks?.[0]?.position || 0) + 1;

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('No authenticated user');
      }

      const selectedSuggestions = suggestions.filter(s => s.selected);

      // Create parent task first
      const { data: parentTask, error: parentError } = await supabase
        .from('tasks')
        .insert({
          title: task?.title,
          description: task?.description,
          status_id: statuses[0]?.id,
          position: nextPosition,
          owner_id: user.id,
          parent_id: parentTaskId || null,
          is_subtask: !!parentTaskId,
        })
        .select()
        .single();

      if (parentError) throw parentError;
      if (!parentTask) throw new Error('Failed to create parent task');

      // Store parent task ID for redirection
      const parentId = parentTask.id;

      // Create all subtasks
      for (let i = 0; i < selectedSuggestions.length; i++) {        
        const suggestion = selectedSuggestions[i];
        const index = suggestions.findIndex(s => s.title === suggestion.title);
        const subtaskPosition = nextPosition + i + 1;

        const { error: subtaskError } = await supabase
          .from('tasks')
          .insert({
            title: suggestion.title,
            description: suggestion.description,
            status_id: statuses[0]?.id,
            due_date: selectedDates[index] || null,
            responsible_id: selectedResponsible[index] || null, 
            coworkers: selectedCoworkers[index] || [], 
            owner_id: user.id,
            parent_id: parentTask.id,
            position: subtaskPosition,
            is_subtask: true,
            priority: selectedPriorities[index] !== undefined ? selectedPriorities[index] : suggestion.priority
          });

        if (subtaskError) throw subtaskError;
      }

      // Log activity for parent task creation
      await taskActivityService.logActivity({
        taskId: parentTask.id,
        field: 'status',
        newValue: statuses[0]?.id,
        type: 'create'
      });

      // Після успішного створення всіх підзадач
      onClose();
      
      // Правильна навігація на батьківську задачу
      if (parentTaskId && companyId) {
        console.log('Navigating to:', `/${companyId}/tasks/${parentTaskId}`);
        window.location.href = `/${companyId}/tasks/${parentTaskId}`;
        // або можна використати
        // window.location.replace(`/${companyId}/tasks/${parentTaskId}`);
      }
      
      onSuccess();

    } catch (err) {
      console.error('Failed to create subtasks:', err);
      setError(err instanceof Error ? err.message : 'Failed to create subtasks');
    } finally {
      setIsCreatingTasks(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-[2px] z-50 flex items-center justify-center">
      <div className="bg-white rounded-xl shadow-xl w-[95vw] max-w-3xl max-h-[90vh] flex flex-col">
        <div className="p-4 border-b flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="text-indigo-600"
              >
                <path
                  d="M10.5 20H4C3.44772 20 3 19.5523 3 19V5C3 4.44772 3.44772 4 4 4H20C20.5523 4 21 4.44772 21 5V10.5M19 14V17M19 17V20M19 17H22M19 17H16"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <h2 className="text-lg font-medium">Suggest Subtasks</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-500"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto">
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">Parent Task</h3>
              <div className="p-4 bg-gray-50 rounded-lg space-y-2">
                <div className="font-medium text-gray-900">
                  {task?.title || 'No title'}
                </div>
                {task?.description && (
                  <div 
                    className="text-sm text-gray-600 prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={{ 
                      __html: task.description 
                    }}
                  />
                )}
                {!task?.description && (
                  <div className="text-sm text-gray-400 italic">
                    No description
                  </div>
                )}
              </div>
            </div>

            {error && (
              <div className="mb-4 p-4 bg-red-50 rounded-lg flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            {(!suggestions || suggestions.length === 0) && !isLoading && (
              <div className="text-center py-8">
                <Wand2 className="w-12 h-12 text-indigo-600 mx-auto mb-4" />
                <h3 className="text-sm font-medium text-gray-900 mb-2">
                  Let AI suggest subtasks
                </h3>
                <p className="text-sm text-gray-500 mb-6">
                  Our AI will analyze your task and suggest a breakdown into smaller, manageable subtasks.
                </p>
                <button
                  onClick={handleGetSuggestions}
                  className={cn(
                    "px-4 py-2 text-sm font-medium rounded-lg",
                    "bg-indigo-600 text-white hover:bg-indigo-700",
                    "flex items-center gap-2 mx-auto"
                  )}
                >
                  <Wand2 className="w-4 h-4" />
                  Get Suggestions
                </button>
              </div>
            )}

            {isLoading && (
              <div className="text-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mx-auto mb-4" />
                <p className="text-sm text-gray-500">
                  Analyzing task and generating suggestions...
                </p>
              </div>
            )}

            {suggestions && suggestions.length > 0 && !isLoading && (
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-gray-900">
                  Suggested Subtasks
                </h3>
                <div className="space-y-3">
                  {suggestions.map((suggestion, index) => (
                    <div 
                      key={`${suggestion.title}-${index}`}
                      className={cn(
                        "p-4 rounded-lg border transition-colors",
                        suggestion.selected 
                          ? "border-indigo-200 bg-indigo-50/50" 
                          : "border-gray-200 bg-white hover:bg-gray-50"
                      )}
                    >
                      <div className="flex items-start gap-3">
                        {/* Checkbox */}
                        <div 
                          onClick={() => handleToggleSubtask(index)}
                          className={cn(
                            "w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 cursor-pointer transition-colors mt-1",
                            suggestion.selected 
                              ? "bg-indigo-600 border-indigo-600 text-white" 
                              : "border-gray-300 hover:border-indigo-500"
                          )}
                        >
                          {suggestion.selected && <Check className="w-3.5 h-3.5" />}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          {editingIndex === index ? (
                            <div className="space-y-2">
                              <input
                                type="text"
                                value={editedTitle}
                                onChange={(e) => setEditedTitle(e.target.value)}
                                className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                                placeholder="Task title"
                              />
                              <textarea
                                value={editedDescription}
                                onChange={(e) => setEditedDescription(e.target.value)}
                                className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 min-h-[80px]"
                                placeholder="Task description (optional)"
                              />
                              <div className="flex justify-end gap-2">
                                <button
                                  onClick={() => setEditingIndex(null)}
                                  className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-700 rounded-lg border border-gray-200 hover:bg-gray-50"
                                >
                                  Cancel
                                </button>
                                <button
                                  onClick={() => handleSaveEdit(index)}
                                  className="px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg"
                                >
                                  Save
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div 
                              className={cn(
                                "transition-opacity",
                                !suggestion.selected && "opacity-50"
                              )}
                            >
                              <div className="flex items-start justify-between gap-4">
                                <h4 className="text-sm font-medium text-gray-900 break-words">
                                  {suggestion.title}
                                </h4>
                                <button
                                  onClick={() => handleStartEdit(index, suggestion.title, suggestion.description || '')}
                                  className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
                                >
                                  <Pencil className="w-4 h-4" />
                                </button>
                              </div>
                              {suggestion.description && (
                                <p className="mt-1 text-sm text-gray-600 break-words">
                                  {suggestion.description}
                                </p>
                              )}
                            </div>
                          )}

                          {/* Task Controls - only show when selected */}
                          {suggestion.selected && (
                            <div className="mt-3 flex flex-wrap items-center gap-2">
                              {/* Due Date */}
                              <div className="relative" data-dropdown>
                                <button
                                  ref={el => buttonRefs.current[`button-${index}-date`] = el}
                                  onClick={(e) => {
                                    // Prevent parent click
                                    e.stopPropagation();
                                    e.preventDefault();
                                    
                                    // Close other dropdowns first
                                    if (dropdownOpen.type && dropdownOpen.type !== 'date') {
                                      setDropdownOpen({ index: -1, type: null });
                                    }
                                    
                                    // Toggle this dropdown
                                    setDropdownOpen({ index, type: 'date' });
                                  }}
                                  className={cn(
                                    "flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors",
                                    selectedDates[index]
                                      ? "bg-indigo-50 text-indigo-600"
                                      : "bg-gray-50 text-gray-600 hover:bg-gray-100"
                                  )}
                                >
                                  <Calendar className="w-3.5 h-3.5" />
                                  {selectedDates[index] 
                                    ? new Date(selectedDates[index]).toLocaleString([], {
                                        year: 'numeric',
                                        month: 'short',
                                        day: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit'
                                      })
                                    : "Due date"
                                  }
                                </button>
                                {dropdownOpen.index === index && dropdownOpen.type === 'date' && suggestion.selected && (
                                  <div 
                                    ref={el => dropdownRefs.current[`${index}-date`] = el}
                                    className="absolute left-0 mt-1 z-50"
                                    onClick={e => e.stopPropagation()}
                                  >
                                    <DueDatePicker
                                      selectedDate={selectedDates[index] || ''}
                                      onChange={(date) => handleDateChange(date, index)}
                                      variant="default"
                                    />
                                  </div>
                                )}
                              </div>

                              {/* Responsible */}
                              <div className="relative" data-dropdown>
                                <button
                                  ref={el => buttonRefs.current[`button-${index}-responsible`] = el}
                                  onClick={(e) => {
                                    // Prevent parent click
                                    e.stopPropagation();
                                    e.preventDefault();
                                    
                                    // Close other dropdowns first  
                                    if (dropdownOpen.type && dropdownOpen.type !== 'responsible') {
                                      setDropdownOpen({ index: -1, type: null });
                                    }
                                    
                                    // Toggle this dropdown
                                    setDropdownOpen({ index, type: 'responsible' });
                                  }}
                                  className={cn(
                                    "flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors",
                                    selectedResponsible[index]
                                      ? "bg-emerald-50 text-emerald-600"
                                      : "bg-gray-50 text-gray-600 hover:bg-gray-100"
                                  )}
                                >
                                  <User className="w-3.5 h-3.5" />
                                  {selectedResponsible[index] 
                                    ? userService.formatUserName(users.find(u => u.id === selectedResponsible[index]) || { id: '', email: 'Unknown' })
                                    : "Responsible"}
                                </button>
                                {dropdownOpen.index === index && dropdownOpen.type === 'responsible' && suggestion.selected && (
                                  <div 
                                    ref={el => dropdownRefs.current[`${index}-responsible`] = el}
                                    className="absolute left-0 mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50"
                                    onClick={e => e.stopPropagation()}
                                  >
                                    {users.map(user => (
                                      <button
                                        key={user.id}
                                        onClick={(e) => handleResponsibleChange(e, user.id, index)}
                                        className={cn(
                                          "w-full px-3 py-1.5 text-sm text-left hover:bg-gray-50 flex items-center",
                                          selectedResponsible[index] === user.id && "bg-emerald-50 text-emerald-600"
                                        )}
                                      >
                                        <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center text-xs font-medium text-emerald-700 mr-2">
                                          {user.email.charAt(0).toUpperCase()}
                                        </div>
                                        <span className="truncate">{userService.formatUserName(user)}</span>
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>

                              {/* Co-workers */}
                              <div className="relative" data-dropdown>
                                <button
                                  ref={el => buttonRefs.current[`button-${index}-coworkers`] = el}
                                  onClick={(e) => {
                                    // Prevent parent click
                                    e.stopPropagation();
                                    e.preventDefault();
                                    
                                    // Close other dropdowns first
                                    if (dropdownOpen.type && dropdownOpen.type !== 'coworkers') {
                                      setDropdownOpen({ index: -1, type: null });
                                    }
                                    
                                    // Toggle this dropdown
                                    setDropdownOpen({ index, type: 'coworkers' });
                                  }}
                                  className={cn(
                                    "flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors",
                                    (selectedCoworkers[index]?.length || 0) > 0
                                      ? "bg-indigo-50 text-indigo-600"
                                      : "bg-gray-50 text-gray-600 hover:bg-gray-100"
                                  )}
                                >
                                  <Users className="w-3.5 h-3.5" />
                                  {(selectedCoworkers[index]?.length || 0) > 0
                                    ? `${selectedCoworkers[index].length} co-worker${selectedCoworkers[index].length !== 1 ? 's' : ''}`
                                    : "Co-workers"}
                                </button>
                                {dropdownOpen.index === index && dropdownOpen.type === 'coworkers' && suggestion.selected && (
                                  <div 
                                    ref={el => dropdownRefs.current[`${index}-coworkers`] = el}
                                    className="absolute left-0 mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50"
                                    onClick={e => e.stopPropagation()}
                                  >
                                    {users.map(user => (
                                      <button
                                        key={user.id}
                                        onClick={(e) => handleCoworkerChange(e, user.id, index)}
                                        className={cn(
                                          "w-full px-3 py-1.5 text-sm text-left hover:bg-gray-50 flex items-center justify-between",
                                          selectedCoworkers[index]?.includes(user.id) && "bg-indigo-50 text-indigo-600",
                                          selectedResponsible[index] === user.id && "opacity-50 cursor-not-allowed"
                                        )}
                                        disabled={selectedResponsible[index] === user.id}
                                      >
                                        <div className="flex items-center">
                                          <div className="w-5 h-5 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-medium text-indigo-700 mr-2">
                                            {user.email.charAt(0).toUpperCase()}
                                          </div>
                                          <span className="truncate">{userService.formatUserName(user)}</span>
                                        </div>
                                        {selectedCoworkers[index]?.includes(user.id) && (
                                          <Check className="w-4 h-4" />
                                        )}
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>

                              {/* Priority */}
                              <div className="relative" data-dropdown>
                                <button
                                  ref={el => buttonRefs.current[`button-${index}-priority`] = el}
                                  onClick={(e) => {
                                    // Prevent parent click
                                    e.stopPropagation();
                                    e.preventDefault();
                                    
                                    // Close other dropdowns first
                                    if (dropdownOpen.type && dropdownOpen.type !== 'priority') {
                                      setDropdownOpen({ index: -1, type: null });
                                    }
                                    
                                    // Toggle this dropdown
                                    setDropdownOpen({ index, type: 'priority' });
                                  }}
                                  className={cn(
                                    "flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors",
                                    selectedPriorities[index]
                                      ? "bg-amber-50 text-amber-600"
                                      : "bg-gray-50 text-gray-600 hover:bg-gray-100"
                                  )}
                                >
                                  <Flame className="w-3.5 h-3.5" />
                                  {selectedPriorities[index] !== undefined
                                    ? `P${selectedPriorities[index]}`
                                    : "Priority"}
                                </button>
                                {dropdownOpen.index === index && dropdownOpen.type === 'priority' && suggestion.selected && (
                                  <div 
                                    ref={el => dropdownRefs.current[`${index}-priority`] = el}
                                    className="absolute left-0 mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50"
                                    onClick={e => e.stopPropagation()}
                                  >
                                    {[0, 1, 2, 3].map(level => (
                                      <button
                                        key={level}
                                        onClick={(e) => {
                                          handlePriorityChange(e, level, index);
                                        }}
                                        className={cn(
                                          "w-full px-3 py-1.5 text-sm text-left hover:bg-gray-50 flex items-center justify-between",
                                          selectedPriorities[index] === level && "bg-amber-50 text-amber-600"
                                        )}
                                      >
                                        <div className="flex items-center">
                                          {level === 0 ? (
                                            <span>No Priority</span>
                                          ) : (
                                            <div className="flex items-center">
                                              <span className="mr-2">Priority {level}</span>
                                              <div className="flex -space-x-1">
                                                {Array.from({ length: level }).map((_, i) => (
                                                  <Flame
                                                    key={`flame-${i}-${level}-${index}-${suggestion.title}`}
                                                    className={cn(
                                                      "w-3.5 h-3.5",
                                                      selectedPriorities[index] === level && "fill-current"
                                                    )}
                                                  />
                                                ))}
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between items-center mt-6">
                  <div className="text-sm text-gray-600">
                    Selected: {selectedCount} of {suggestions.length}
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={handleGetSuggestions}
                      className={cn(
                        "px-4 py-2 text-sm font-medium rounded-lg",
                        "bg-gray-100 text-gray-600",
                        "hover:bg-gray-200 hover:text-gray-700",
                        "flex items-center gap-2",
                        "transition-all duration-200",
                        isCreatingTasks && "opacity-50 cursor-not-allowed"
                      )}
                      disabled={isCreatingTasks}
                    >
                      <Wand2 className="w-4 h-4" />
                      Regenerate
                    </button>
                    <button
                      onClick={handleCreateSubtasks}
                      disabled={selectedCount === 0 || isCreatingTasks}
                      title={selectedCount === 0 ? "Select at least one subtask" : undefined}
                      className={cn(
                        "px-4 py-2 text-sm font-medium rounded-lg",
                        "bg-indigo-600 text-white",
                        "hover:bg-indigo-500 shadow-sm hover:shadow",
                        "disabled:opacity-50 disabled:cursor-not-allowed",
                        "flex items-center gap-2 min-w-[180px] justify-center",
                        "transition-all duration-200"
                      )}
                    >
                      {isCreatingTasks ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Creating {selectedCount} Subtask{selectedCount !== 1 && 's'}...
                        </>
                      ) : (
                        <>
                          <ChevronRight className="w-4 h-4" />
                          Create {selectedCount} Subtask{selectedCount !== 1 && 's'}
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="flex justify-end gap-3 sticky bottom-0 pt-4 bg-white border-t mt-4">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}