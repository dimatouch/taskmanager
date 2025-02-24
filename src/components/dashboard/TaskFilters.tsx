import { useState, useEffect, useCallback, useRef } from 'react';
import { Search, Filter, X, ChevronDown, Flame } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { TaskStatus, Project } from './types';
import { userService } from '../../services/userService';
import { supabase } from '../../lib/supabase';

export interface TaskFilters {
  search: string;
  status: string[];
  project: string[];
  owner: string[];
  responsible: string[];
  coworkers: string[];
  priority: number[];
  completed: boolean | null;
  dueDateRange: {
    from: string | null;
    to: string | null;
  };
}

interface TaskFiltersProps {
  statuses: TaskStatus[];
  projects: Project[];
  users: { id: string; email: string }[];
  onFiltersChange: (filters: TaskFilters) => void;
}

export function TaskFilters({ statuses, projects, users, onFiltersChange }: TaskFiltersProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const dropdownsRef = useRef<HTMLDivElement>(null);
  const dropdownMenusRef = useRef<{ [key: string]: HTMLDivElement | null }>({});
  const [currentUser, setCurrentUser] = useState<{ id: string } | null>(null);

  const [filters, setFilters] = useState<TaskFilters>({
    search: '',
    status: [],
    owner: [],
    project: [],
    responsible: [],
    coworkers: [],
    priority: [],
    completed: null,
    dueDateRange: { from: null, to: null },
  });

  useEffect(() => {
    const fetchCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUser(user);
      }
    };
    fetchCurrentUser();
  }, []);

  const formatDateForComparison = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate())
      .toISOString()
      .split('T')[0];
  };

  const isToday = (dateStr: string) => {
    const today = formatDateForComparison(new Date());
    return dateStr === today;
  };

  const isTomorrow = (dateStr: string) => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return dateStr === formatDateForComparison(tomorrow);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!dropdownsRef.current?.contains(event.target as Node)) {
        setActiveDropdown(null);
        return;
      }
      if (activeDropdown) {
        const activeMenu = dropdownMenusRef.current[activeDropdown];
        const activeButton = document.querySelector(`[data-dropdown-button="${activeDropdown}"]`);
        if (!activeMenu?.contains(event.target as Node) && !activeButton?.contains(event.target as Node)) {
          setActiveDropdown(null);
        }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [activeDropdown]);

  const toggleDropdown = (dropdownId: string) => {
    setActiveDropdown((prev) => (prev === dropdownId ? null : dropdownId));
  };

  const updateFilters = useCallback(
    (newFilters: TaskFilters) => {
      setFilters(newFilters);
      onFiltersChange(newFilters);
    },
    [onFiltersChange]
  );

  useEffect(() => {
    updateFilters(filters);
  }, [filters, updateFilters]);

  const clearFilters = () => {
    updateFilters({
      search: '',
      status: [],
      owner: [],
      project: [],
      responsible: [],
      coworkers: [],
      priority: [],
      completed: null,
      dueDateRange: { from: null, to: null },
    });
  };

  const hasActiveFilters = () => {
    return (
      filters.search.trim() !== '' ||
      filters.status.length > 0 ||
      filters.project.length > 0 ||
      filters.responsible.length > 0 ||
      filters.coworkers.length > 0 ||
      filters.priority.length > 0 ||
      filters.completed !== null ||
      !!filters.dueDateRange.from ||
      !!filters.dueDateRange.to ||
      filters.owner.length > 0
    );
  };

  return (
    <div className="mb-8" ref={dropdownsRef}>
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 divide-y divide-gray-200">
        <div className="p-4 flex items-center gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={filters.search}
              onChange={(e) => updateFilters({ ...filters, search: e.target.value })}
              placeholder="Search tasks..."
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsOpen(!isOpen)}
              className={cn(
                "px-4 py-2 rounded-lg border text-sm font-medium flex items-center gap-2 transition-colors",
                isOpen
                  ? "bg-indigo-50 border-indigo-200 text-indigo-700"
                  : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50",
                hasActiveFilters() && !isOpen && "bg-indigo-50 border-indigo-200 text-indigo-700"
              )}
            >
              <Filter className="w-4 h-4" />
              Filters
              {hasActiveFilters() && (
                <span className="ml-1 px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 text-xs">
                  {Object.values(filters).reduce(
                    (acc, val) => acc + (Array.isArray(val) ? val.length : val ? 1 : 0),
                    0
                  )}
                </span>
              )}
            </button>
            {hasActiveFilters() && (
              <button
                onClick={clearFilters}
                className="px-3 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors flex items-center gap-2"
              >
                <X className="w-4 h-4" />
                Clear
              </button>
            )}
          </div>
        </div>

        <div className="px-4 py-3 bg-gray-50/80 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-gray-500">Tasks:</span>
            <button
              onClick={() => {
                const newResponsible =
                  currentUser && filters.responsible.includes(currentUser.id)
                    ? filters.responsible.filter((id) => id !== currentUser.id)
                    : currentUser
                    ? [...filters.responsible, currentUser.id]
                    : filters.responsible;
                updateFilters({ ...filters, responsible: newResponsible });
              }}
              className={cn(
                "px-3 py-1.5 text-xs font-medium rounded-lg transition-colors",
                currentUser && filters.responsible.includes(currentUser.id)
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              )}
            >
              Assigned to Me
            </button>
            <button
              onClick={() => {
                const newOwner =
                  currentUser && filters.owner.includes(currentUser.id)
                    ? []
                    : currentUser
                    ? [currentUser.id]
                    : [];
                updateFilters({ ...filters, owner: newOwner });
              }}
              className={cn(
                "px-3 py-1.5 text-xs font-medium rounded-lg transition-colors",
                currentUser && filters.owner.includes(currentUser.id)
                  ? "bg-blue-100 text-blue-700"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              )}
            >
              Created by Me
            </button>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-gray-500">Due Date:</span>
            <button
              onClick={() => {
                if (isToday(filters.dueDateRange.from || '') && isToday(filters.dueDateRange.to || '')) {
                  updateFilters({ ...filters, dueDateRange: { from: null, to: null } });
                } else {
                  const today = formatDateForComparison(new Date());
                  updateFilters({ ...filters, dueDateRange: { from: today, to: today } });
                }
              }}
              className={cn(
                "px-3 py-1.5 text-xs font-medium rounded-lg transition-colors",
                isToday(filters.dueDateRange.from || '') && isToday(filters.dueDateRange.to || '')
                  ? "bg-blue-100 text-blue-700"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              )}
            >
              Due Today
            </button>
            <button
              onClick={() => {
                if (isTomorrow(filters.dueDateRange.from || '')) {
                  updateFilters({ ...filters, dueDateRange: { from: null, to: null } });
                } else {
                  const tomorrow = new Date();
                  tomorrow.setDate(tomorrow.getDate() + 1);
                  tomorrow.setHours(0, 0, 0, 0);
                  const tomorrowStr = formatDateForComparison(tomorrow);
                  updateFilters({ ...filters, dueDateRange: { from: tomorrowStr, to: tomorrowStr } });
                }
              }}
              className={cn(
                "px-3 py-1.5 text-xs font-medium rounded-lg transition-colors",
                isTomorrow(filters.dueDateRange.from || '')
                  ? "bg-blue-100 text-blue-700"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              )}
            >
              Due Tomorrow
            </button>
            <button
              onClick={() => {
                if (filters.dueDateRange.from && filters.dueDateRange.to) {
                  updateFilters({ ...filters, dueDateRange: { from: null, to: null } });
                } else {
                  const today = new Date();
                  const startOfWeek = new Date(today);
                  const endOfWeek = new Date(today);
                  startOfWeek.setHours(0, 0, 0, 0);
                  endOfWeek.setHours(0, 0, 0, 0);
                  startOfWeek.setDate(
                    today.getDate() - today.getDay() + (today.getDay() === 0 ? -6 : 1)
                  );
                  endOfWeek.setDate(startOfWeek.getDate() + 6);
                  updateFilters({
                    ...filters,
                    dueDateRange: {
                      from: formatDateForComparison(startOfWeek),
                      to: formatDateForComparison(endOfWeek)
                    }
                  });
                }
              }}
              className={cn(
                "px-3 py-1.5 text-xs font-medium rounded-lg transition-colors",
                filters.dueDateRange.from && filters.dueDateRange.to
                  ? "bg-blue-100 text-blue-700"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              )}
            >
              This Week
            </button>
          </div>
        </div>

        {isOpen && (
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
            <div className="grid grid-cols-4 gap-4">
              <div className="col-span-2">
                <div className="relative">
                  <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
                  <button
                    type="button"
                    data-dropdown-button="status"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleDropdown('status');
                    }}
                    className="w-full px-3 py-1.5 text-sm bg-white border rounded-lg flex items-center justify-between hover:bg-gray-50"
                  >
                    <span className="truncate">
                      {filters.status.length === 0
                        ? 'All statuses'
                        : filters.status.length === 1
                        ? statuses.find((s) => s.id === filters.status[0])?.name
                        : `${filters.status.length} statuses`}
                    </span>
                    <ChevronDown className="w-4 h-4 ml-2 text-gray-400" />
                  </button>
                  <div
                    data-dropdown-menu
                    ref={(el) => (dropdownMenusRef.current['status'] = el)}
                    className={cn(
                      "absolute left-0 right-0 mt-1 w-64 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-[100]",
                      activeDropdown === 'status' ? 'block' : 'hidden'
                    )}
                  >
                    <div className="p-2 max-h-48 overflow-y-auto">
                      {statuses.map((status) => (
                        <label
                          key={status.id}
                          className="flex items-center px-2 py-1 hover:bg-gray-50 rounded cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={filters.status.includes(status.id)}
                            onChange={(e) => {
                              setFilters((prev) => ({
                                ...prev,
                                status: e.target.checked
                                  ? [...prev.status, status.id]
                                  : prev.status.filter((id) => id !== status.id)
                              }));
                            }}
                            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                          />
                          <div className="ml-2 flex items-center">
                            <div className="w-2 h-2 rounded-full mr-2" style={{ backgroundColor: status.color }} />
                            <span className="text-sm text-gray-700">{status.name}</span>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="col-span-1">
                <div className="relative">
                  <label className="block text-xs font-medium text-gray-500 mb-1">Project</label>
                  <button
                    type="button"
                    data-dropdown-button="project"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleDropdown('project');
                    }}
                    className="w-full px-3 py-1.5 text-sm bg-white border rounded-lg flex items-center justify-between hover:bg-gray-50"
                  >
                    <span className="truncate">
                      {filters.project.length === 0
                        ? 'All projects'
                        : filters.project.length === 1
                        ? projects.find((p) => p.id === filters.project[0])?.name
                        : `${filters.project.length} projects`}
                    </span>
                    <ChevronDown className="w-4 h-4 ml-2 text-gray-400" />
                  </button>
                  <div
                    data-dropdown-menu
                    ref={(el) => (dropdownMenusRef.current['project'] = el)}
                    className={cn(
                      "absolute left-0 right-0 mt-1 w-64 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-[100]",
                      activeDropdown === 'project' ? 'block' : 'hidden'
                    )}
                  >
                    <div className="p-2 max-h-48 overflow-y-auto">
                      {projects.map((project) => (
                        <label key={project.id} className="flex items-center px-2 py-1 hover:bg-gray-50 rounded cursor-pointer">
                          <input
                            type="checkbox"
                            checked={filters.project.includes(project.id)}
                            onChange={(e) => {
                              setFilters((prev) => ({
                                ...prev,
                                project: e.target.checked
                                  ? [...prev.project, project.id]
                                  : prev.project.filter((id) => id !== project.id)
                              }));
                            }}
                            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                          />
                          <span className="ml-2 text-sm text-gray-700">{project.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="col-span-1">
                <div className="relative">
                  <label className="block text-xs font-medium text-gray-500 mb-1">Priority</label>
                  <button
                    type="button"
                    data-dropdown-button="priority"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleDropdown('priority');
                    }}
                    className="w-full px-3 py-1.5 text-sm bg-white border rounded-lg flex items-center justify-between hover:bg-gray-50"
                  >
                    <span className="truncate">
                      {filters.priority.length === 0
                        ? 'Any priority'
                        : filters.priority.length === 1
                        ? `${filters.priority[0]} flame${filters.priority[0] === 1 ? '' : 's'}`
                        : `${filters.priority.length} priorities`}
                    </span>
                    <ChevronDown className="w-4 h-4 ml-2 text-gray-400" />
                  </button>
                  <div
                    data-dropdown-menu
                    ref={(el) => (dropdownMenusRef.current['priority'] = el)}
                    className={cn(
                      "absolute left-0 right-0 mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-[100]",
                      activeDropdown === 'priority' ? 'block' : 'hidden'
                    )}
                  >
                    <div className="p-2 max-h-48 overflow-y-auto">
                      {[1, 2, 3].map((level) => (
                        <label key={level} className="flex items-center px-2 py-1 hover:bg-gray-50 rounded cursor-pointer">
                          <input
                            type="checkbox"
                            checked={filters.priority.includes(level)}
                            onChange={(e) => {
                              setFilters((prev) => ({
                                ...prev,
                                priority: e.target.checked
                                  ? [...prev.priority, level]
                                  : prev.priority.filter((p) => p !== level)
                              }));
                            }}
                            className="rounded border-gray-300 text-amber-500 focus:ring-amber-500"
                          />
                          <div className="ml-2 flex items-center">
                            <div className="flex -space-x-1">
                              {Array.from({ length: level }).map((_, i) => (
                                <Flame
                                  key={i}
                                  className="w-4 h-4 text-amber-500 fill-current"
                                  style={{ transform: `translateX(${i * 4}px)` }}
                                />
                              ))}
                            </div>
                            <span className="ml-3 text-sm text-gray-700">
                              {level} flame{level === 1 ? '' : 's'}
                            </span>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="col-span-1">
                <div className="relative">
                  <label className="block text-xs font-medium text-gray-500 mb-1">Responsible</label>
                  <button
                    type="button"
                    data-dropdown-button="responsible"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleDropdown('responsible');
                    }}
                    className="w-full px-3 py-1.5 text-sm bg-white border rounded-lg flex items-center justify-between hover:bg-gray-50"
                  >
                    <span className="truncate">
                      {filters.responsible.length === 0
                        ? 'Anyone'
                        : filters.responsible.length === 1
                        ? users.find((u) => u.id === filters.responsible[0])?.email
                        : `${filters.responsible.length} users`}
                    </span>
                    <ChevronDown className="w-4 h-4 ml-2 text-gray-400" />
                  </button>
                  <div
                    data-dropdown-menu
                    ref={(el) => (dropdownMenusRef.current['responsible'] = el)}
                    className={cn(
                      "absolute left-0 right-0 mt-1 w-64 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-[100]",
                      activeDropdown === 'responsible' ? 'block' : 'hidden'
                    )}
                  >
                    <div className="p-2 max-h-48 overflow-y-auto">
                      {users.map((user) => (
                        <label key={user.id} className="flex items-center px-2 py-1 hover:bg-gray-50 rounded cursor-pointer">
                          <input
                            type="checkbox"
                            checked={filters.responsible.includes(user.id)}
                            onChange={(e) => {
                              setFilters((prev) => ({
                                ...prev,
                                responsible: e.target.checked
                                  ? [...prev.responsible, user.id]
                                  : prev.responsible.filter((id) => id !== user.id)
                              }));
                            }}
                            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                          />
                          <div className="ml-2 flex items-center">
                            <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center text-xs font-medium text-emerald-700">
                              {userService.formatUserName(user).charAt(0).toUpperCase()}
                            </div>
                            <span className="ml-2 text-sm text-gray-700">{userService.formatUserName(user)}</span>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="col-span-1">
                <div className="relative">
                  <label className="block text-xs font-medium text-gray-500 mb-1">Co-workers</label>
                  <button
                    type="button"
                    data-dropdown-button="coworkers"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleDropdown('coworkers');
                    }}
                    className="w-full px-3 py-1.5 text-sm bg-white border rounded-lg flex items-center justify-between hover:bg-gray-50"
                  >
                    <span className="truncate">
                      {filters.coworkers.length === 0
                        ? 'Anyone'
                        : filters.coworkers.length === 1
                        ? users.find((u) => u.id === filters.coworkers[0])?.email
                        : `${filters.coworkers.length} users`}
                    </span>
                    <ChevronDown className="w-4 h-4 ml-2 text-gray-400" />
                  </button>
                  <div
                    data-dropdown-menu
                    ref={(el) => (dropdownMenusRef.current['coworkers'] = el)}
                    className={cn(
                      "absolute left-0 right-0 mt-1 w-64 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-[100]",
                      activeDropdown === 'coworkers' ? 'block' : 'hidden'
                    )}
                  >
                    <div className="p-2 max-h-48 overflow-y-auto">
                      {users.map((user) => (
                        <label key={user.id} className="flex items-center px-2 py-1 hover:bg-gray-50 rounded cursor-pointer">
                          <input
                            type="checkbox"
                            checked={filters.coworkers.includes(user.id)}
                            onChange={(e) => {
                              setFilters((prev) => ({
                                ...prev,
                                coworkers: e.target.checked
                                  ? [...prev.coworkers, user.id]
                                  : prev.coworkers.filter((id) => id !== user.id)
                              }));
                            }}
                            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                          />
                          <div className="ml-2 flex items-center">
                            <div className="w-5 h-5 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-medium text-indigo-700">
                              {userService.formatUserName(user).charAt(0).toUpperCase()}
                            </div>
                            <span className="ml-2 text-sm text-gray-700">{userService.formatUserName(user)}</span>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}