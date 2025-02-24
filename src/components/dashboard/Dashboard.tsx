import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Plus, ChevronUp, ChevronDown, CheckSquare, LayoutGrid, List } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { cn } from '../../lib/utils';
import { QuickTaskModal } from './QuickTaskModal';
import { userService } from '../../services/userService';
import { useTranslation } from '../../lib/i18n/useTranslation';
import { Database } from '../../types/supabase';
import { KanbanBoard } from './KanbanBoard';
import { Task } from './Task';
import { TaskSelection } from './TaskSelection';
import { TaskFilters, type TaskFilters as TaskFiltersType } from './TaskFilters';

type Task = Database['public']['Tables']['tasks']['Row'];
type TaskStatus = Database['public']['Tables']['task_statuses']['Row'];
type Project = Database['public']['Tables']['projects']['Row'];

type SortField = 'title' | 'status' | 'due_date' | 'responsible' | 'coworkers' | 'last_update';
type SortDirection = 'asc' | 'desc';

interface SortConfig {
  field: SortField;
  direction: SortDirection;
}

interface DashboardProps {
  filter?: 'my' | 'assigned' | 'recent' | 'created';
  projectId?: string;
}

export function Dashboard({ filter, projectId }: DashboardProps) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [filteredTasks, setFilteredTasks] = useState<Task[]>([]);
  const [selectedTasks, setSelectedTasks] = useState<string[]>([]);
  const [statuses, setStatuses] = useState<TaskStatus[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isQuickTaskOpen, setIsQuickTaskOpen] = useState(false);
  const [users, setUsers] = useState<{ id: string; email: string }[]>([]);
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    field: 'created_at' as SortField,
    direction: 'desc'
  });
  const [taskActivities, setTaskActivities] = useState<{ task_id: string; created_at: string }[]>([]);
  const [isLoadingTasks, setIsLoadingTasks] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<{ id: string } | null>(null);
  const [taskStats, setTaskStats] = useState({
    active: 0,
    completed: 0,
    overdue: 0
  });
  const [showViewerOnly, setShowViewerOnly] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    // Get userId from URL if present
    const params = new URLSearchParams(window.location.search);
    const urlUserId = params.get('userId');
    setUserId(urlUserId);

    fetchInitialData();
  }, [showViewerOnly, filter]);

  // Fetch all initial data
  async function fetchInitialData() {
    try {
      setIsLoading(true);
      const [projectsData, statusesData, usersData] = await Promise.all([
        fetchProjects(),
        fetchStatuses(),
        userService.getUsers()
      ]);

      setProjects(projectsData || []);
      setStatuses(statusesData || []);
      setUsers(usersData);

      await fetchTasks();
    } catch (err) {
      console.error('Failed to fetch initial data:', err);
      setError('Failed to load data');
    } finally {
      setIsLoading(false);
    }
  }

  // Fetch statuses from Supabase
  async function fetchStatuses() {
    try {
      const { data, error } = await supabase
        .from('task_statuses')
        .select('*')
        .order('position');
      if (error) throw error;
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load statuses');
      return [];
    }
  }

  // Callback to filter tasks based on TaskFilters settings
  const handleFiltersChange = useCallback(async (filters: TaskFiltersType) => {
    let filtered = [...tasks];
    const normalizeDate = (date: string | null) => {
      if (!date) return null;
      return new Date(date).toISOString().split('T')[0];
    };

    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(task =>
        task.title.toLowerCase().includes(searchLower) ||
        task.description?.toLowerCase().includes(searchLower)
      );
    }

    if (filters.status.length > 0) {
      filtered = filtered.filter(task => filters.status.includes(task.status_id));
    }

    if (filters.project.length > 0) {
      filtered = filtered.filter(task =>
        task.project_id && filters.project.includes(task.project_id)
      );
    }

    if (filters.priority.length > 0) {
      filtered = filtered.filter(task =>
        filters.priority.includes(task.priority)
      );
    }

    if (filters.responsible.length > 0 || filters.coworkers.length > 0) {
      if (filters.responsible.length > 0) {
        filtered = filtered.filter(task =>
          task.responsible_id && filters.responsible.includes(task.responsible_id)
        );
      }
      if (filters.coworkers.length > 0) {
        filtered = filtered.filter(task =>
          task.coworkers && task.coworkers.some(id => filters.coworkers.includes(id))
        );
      }
    }

    if (filters.dueDateRange.from) {
      const fromDate = normalizeDate(filters.dueDateRange.from);
      filtered = filtered.filter(task => {
        const taskDate = normalizeDate(task.due_date);
        return taskDate && fromDate && taskDate >= fromDate;
      });
    }
    if (filters.dueDateRange.to) {
      const toDate = normalizeDate(filters.dueDateRange.to);
      filtered = filtered.filter(task => {
        const taskDate = normalizeDate(task.due_date);
        return taskDate && toDate && taskDate <= toDate;
      });
    }

    if (filters.completed !== null) {
      filtered = filtered.filter(task =>
        filters.completed ? task.result !== null : task.result === null
      );
    }

    setFilteredTasks(filtered);
  }, [tasks]);

  const handleSort = useCallback((field: SortField) => {
    setSortConfig(prev => ({
      field,
      direction: prev.field === field ? (prev.direction === 'asc' ? 'desc' : 'asc') : 'asc'
    }));
  }, []);

  const sortTasks = useCallback((tasksToSort: Task[]) => {
    return [...tasksToSort].sort((a, b) => {
      const direction = sortConfig.direction === 'asc' ? 1 : -1;
      const nullsLast = direction;
      switch (sortConfig.field) {
        case 'title':
          return direction * a.title.localeCompare(b.title);
        case 'status': {
          const statusA = statuses.find(s => s.id === a.status_id);
          const statusB = statuses.find(s => s.id === b.status_id);
          if (!statusA && !statusB) return 0;
          if (!statusA) return nullsLast;
          if (!statusB) return -nullsLast;
          return direction * (statusA.position - statusB.position);
        }
        case 'due_date': {
          if (!a.due_date && !b.due_date) return 0;
          if (!a.due_date) return nullsLast;
          if (!b.due_date) return -nullsLast;
          return direction * (new Date(a.due_date).getTime() - new Date(b.due_date).getTime());
        }
        case 'responsible': {
          if (!a.responsible_id && !b.responsible_id) return 0;
          if (!a.responsible_id) return nullsLast;
          if (!b.responsible_id) return -nullsLast;
          const userA = users.find(u => u.id === a.responsible_id)?.email || '';
          const userB = users.find(u => u.id === b.responsible_id)?.email || '';
          return direction * userA.localeCompare(userB);
        }
        case 'coworkers': {
          const coworkersA = a.coworkers?.length || 0;
          const coworkersB = b.coworkers?.length || 0;
          return direction * (coworkersA - coworkersB);
        }
        case 'created_at': {
          return direction * (new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        }
        case 'last_update': {
          const getLastUpdate = (taskId: string) => {
            const lastActivity = taskActivities
              .filter(ta => ta.task_id === taskId)
              .sort((x, y) =>
                new Date(y.created_at).getTime() - new Date(x.created_at).getTime()
              )[0];
            return lastActivity?.created_at;
          };
          const lastUpdateA = getLastUpdate(a.id) || a.updated_at || a.created_at;
          const lastUpdateB = getLastUpdate(b.id) || b.updated_at || b.created_at;
          return direction * (new Date(lastUpdateA).getTime() - new Date(lastUpdateB).getTime());
        }
        default:
          return 0;
      }
    }).filter(Boolean);
  }, [sortConfig, statuses, taskActivities, users]);

  useEffect(() => {
    setFilteredTasks(prev => sortTasks(prev));
  }, [sortTasks]);

  // Fetch initial data
  useEffect(() => {
    async function fetchInitialData() {
      try {
        // Get current user
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          setCurrentUser(user);
        }

        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          throw new Error('Authentication required');
        }

        const [fetchedProjects, fetchedActivities, fetchedUsers] = await Promise.all([
          fetchProjects(),
          fetchTaskActivities(),
          userService.getUsers()
        ]);

        // Додаємо логування
        console.log('Fetched users in Dashboard:', fetchedUsers);

        // Set users state
        setUsers(fetchedUsers);

        if (fetchedProjects) setProjects(fetchedProjects);
        if (fetchedActivities) setTaskActivities(fetchedActivities);
        setSaveError(null);
      } catch (err) {
        if (!(err instanceof Error) || !err.message.includes('Failed to fetch')) {
          console.error('Failed to fetch initial data:', err);
          setSaveError(err instanceof Error ? err.message : 'Failed to load task data');
        }
      }
    }
    Promise.all([fetchTasks()])
      .catch(err => {
        if (!(err instanceof Error && err.message.includes('Failed to fetch'))) {
          setError(err instanceof Error ? err.message : 'Failed to load tasks');
        }
      })
      .finally(() => {
        fetchStatuses();
        setIsLoading(false);
      });
  }, []);

  // Refetch tasks whenever showViewerOnly changes
  useEffect(() => {
    fetchTasks();
  }, [showViewerOnly, filter, userId]);

  useEffect(() => {
    setFilteredTasks(prev => sortTasks(prev));
  }, [currentUser?.id]);

  async function fetchTaskActivities() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;
      const { data, error } = await supabase
        .from('task_activities')
        .select('task_id, created_at')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    } catch (err) {
      console.error('Failed to fetch task activities:', err);
    }
  }

  async function fetchProjects() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .order('name');
      if (error) throw error;
      return data;
    } catch (err) {
      console.error('Failed to fetch projects:', err);
      return [];
    }
  }

  async function fetchTasks() {
    try {
      setIsLoadingTasks(true);
      setError(null);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError('Please sign in to view tasks');
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No authenticated user');

      if (showViewerOnly) {
        console.log('Fetching viewer-only tasks...');
        const { data: viewerRoles, error: rolesError } = await supabase
          .from('task_roles')
          .select('task_id')
          .eq('user_id', user.id)
          .eq('role', 'viewer');

        if (rolesError) throw rolesError;
        if (!viewerRoles?.length) {
          setTasks([]);
          setFilteredTasks([]);
          return;
        }

        const taskIds = viewerRoles.map(v => v.task_id);

        const { data: viewerTasks, error: viewerError } = await supabase
          .from('tasks')
          .select(`
            id,
            title,
            description,
            status_id,
            responsible_id,
            coworkers,
            created_at,
            updated_at,
            project_id,
            owner_id,
            due_date,
            priority,
            result
          `)
          .in('id', taskIds);

        if (viewerError) throw viewerError;
        setTasks(viewerTasks || []);
        setFilteredTasks(viewerTasks || []);
        return;
      }

      let query = supabase.from('tasks').select(`
        id,
        title,
        description,
        status_id,
        responsible_id,
        coworkers,
        created_at,
        updated_at,
        project_id,
        owner_id,
        due_date,
        priority,
        result
      `);
      console.log('Fetching tasks with filter:', filter);
      
      if (projectId) {
        query = query.eq('project_id', projectId);
      }
      
      if (filter === 'created') {
        // If viewing another user's tasks, use their ID, otherwise use current user's ID
        const targetUserId = userId || user.id;
        query = query.eq('owner_id', targetUserId);
      } else {
        query = query.or(
          `owner_id.eq.${user.id},` +
          `responsible_id.eq.${user.id},` +
          `coworkers.cs.{${user.id}}`
        );
      }

      query = query.order('created_at', { ascending: false });
      const { data: tasks, error } = await query;
      if (error) throw error;

      setTasks(tasks || []);
      setFilteredTasks(tasks || []);

      const now = new Date();
      const userTasks = tasks || [];
      const doneStatus = statuses.find(s => s.name === 'Done')?.id;
      setTaskStats({
        active: userTasks.filter(t => t.status_id !== doneStatus).length,
        completed: userTasks.filter(t => t.status_id === doneStatus).length,
        overdue: userTasks.filter(t =>
          t.status_id !== doneStatus &&
          t.due_date &&
          new Date(t.due_date) < now
        ).length
      });
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to load tasks');
      }
    } finally {
      setIsLoadingTasks(false);
    }
  }

  const handleSelectAll = () => {
    if (selectedTasks.length === filteredTasks.length) {
      setSelectedTasks([]);
    } else {
      setSelectedTasks(filteredTasks.map(task => task.id));
    }
  };

  const handleSelectTask = (taskId: string) => {
    setSelectedTasks(prev => {
      if (prev.includes(taskId)) {
        return prev.filter(id => id !== taskId);
      } else {
        return [...prev, taskId];
      }
    });
  };

  const handleBulkDelete = async () => {
    if (!selectedTasks.length) return;
    try {
      setIsDeleting('bulk');
      const { error } = await supabase
        .from('tasks')
        .delete()
        .in('id', selectedTasks);
      if (error) throw error;
      await fetchTasks();
      setSelectedTasks([]);
    } catch (err) {
      console.error('Failed to delete tasks:', err);
    } finally {
      setIsDeleting(null);
    }
  };

  const handleBulkStatusChange = async (statusId: string) => {
    if (!selectedTasks.length) return;
    try {
      setIsUpdatingStatus(true);
      const { error } = await supabase
        .from('tasks')
        .update({ status_id: statusId })
        .in('id', selectedTasks);
      if (error) throw error;
      await fetchTasks();
      setSelectedTasks([]);
      setShowStatusDropdown(false);
    } catch (err) {
      console.error('Failed to update task statuses:', err);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  if (isLoading || isLoadingTasks) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex justify-between items-center mb-8">
        <div className="flex items-center gap-6">
          <h1 className="text-2xl font-bold text-gray-900">
            {(() => {
              if (projectId) return t('tasks.projectTasks');
              if (filter === 'my') return t('tasks.myTasks');
              if (filter === 'created') return t('tasks.createdTasks');
              return t('tasks.allTasks');
            })()}
          </h1>
          <button
            onClick={() => setShowViewerOnly(prev => !prev)}
            className={cn(
              "px-3 py-1.5 text-sm font-medium rounded-lg transition-colors",
              showViewerOnly
                ? "bg-indigo-100 text-indigo-700 ring-2 ring-indigo-200"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            )}
          >
            {t('tasks.viewerOnly')}
          </button>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setViewMode(prev => prev === 'list' ? 'kanban' : 'list')}
            className={cn(
              "px-3 py-1.5 text-sm font-medium rounded-lg transition-colors",
              "bg-gray-100 text-gray-600 hover:bg-gray-200",
              "flex items-center gap-2"
            )}
          >
            {viewMode === 'list' ? (
              <>
                <LayoutGrid className="w-4 h-4" />
                Kanban
              </>
            ) : (
              <>
                <List className="w-4 h-4" />
                List
              </>
            )}
          </button>
          <button
            onClick={() => setIsQuickTaskOpen(true)}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-500 hover:bg-primary-600"
          >
            <Plus className="w-4 h-4 mr-2" />
            {t('tasks.addTask')}
          </button>
        </div>
      </div>
      <TaskFilters
        statuses={statuses}
        projects={projects}
        users={users}
        onFiltersChange={handleFiltersChange}
      />
      {error && (
        <div className="rounded-md bg-red-50 p-4 mb-8">
          <div className="flex">
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error</h3>
              <div className="mt-2 text-sm text-red-700">
                <p>{error}</p>
              </div>
            </div>
          </div>
        </div>
      )}
      <QuickTaskModal
        isOpen={isQuickTaskOpen}
        onClose={() => setIsQuickTaskOpen(false)}
        onSuccess={() => {
          fetchTasks();
          setIsQuickTaskOpen(false);
        }}
        statuses={statuses}
        users={users}
        projectId={projectId}
      />
      {!isLoading && !error && filteredTasks.length === 0 && (
        <div className="bg-white rounded-lg shadow-sm border p-8 text-center">
          <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckSquare className="w-8 h-8 text-indigo-600" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {(() => {
              if (filter === 'my') return t('tasks.noTasks.my');
              if (filter === 'created') return t('tasks.noTasks.created');
              if (filter === 'assigned') return t('tasks.noTasks.assigned');
              if (filter === 'recent') return t('tasks.noTasks.recent');
              return t('tasks.noTasks.all');
            })()}
          </h3>
          <p className="text-gray-500 mb-6">
            {(() => {
              if (filter === 'my') return t('tasks.noTasksDescription.my');
              if (filter === 'created') return t('tasks.noTasksDescription.created');
              if (filter === 'assigned') return t('tasks.noTasksDescription.assigned');
              if (filter === 'recent') return t('tasks.noTasksDescription.recent');
              return t('tasks.noTasksDescription.filtered');
            })()}
          </p>
          <button
            onClick={() => setIsQuickTaskOpen(true)}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-500 hover:bg-primary-600"
          >
            <Plus className="w-4 h-4 mr-2" />
            {t('tasks.createTask')}
          </button>
        </div>
      )}
      {!isLoading && !error && filteredTasks.length > 0 && viewMode === 'list' && (
        <div className="bg-white rounded-xl shadow-lg border overflow-x-auto">
          <div
            className="grid grid-cols-8 border-b bg-gray-50/80 sticky top-0 z-10"
          >
            <div className="col-span-3 px-6 py-4 flex items-center">
              <div className="flex items-center gap-2">
                <TaskSelection
                  selectedTasks={selectedTasks}
                  onSelectAll={handleSelectAll}
                  onBulkDelete={handleBulkDelete}
                  onBulkStatusChange={handleBulkStatusChange}
                  statuses={statuses}
                  isDeleting={isDeleting === 'bulk'}
                  isUpdatingStatus={isUpdatingStatus}
                  totalTasks={filteredTasks.length}
                />
                <div
                  onClick={() => handleSort('title')}
                  className="flex items-center cursor-pointer"
                >
                  <span className="text-sm font-medium text-gray-500">Title</span>
                  {sortConfig.field === 'title' && (
                    sortConfig.direction === 'asc' ? (
                      <ChevronUp className="w-4 h-4 ml-1" />
                    ) : (
                      <ChevronDown className="w-4 h-4 ml-1" />
                    )
                  )}
                </div>
              </div>
            </div>
            <div className="col-span-1 px-6 py-4 text-sm font-medium text-gray-500 truncate relative group cursor-pointer hover:bg-gray-100 flex items-center justify-center"
              onClick={() => handleSort('status')}
            >
              <div className="flex items-center justify-center">
                <span className="block truncate pr-2">{t('tasks.status')}</span>
                {sortConfig.field === 'status' && (
                  sortConfig.direction === 'asc' ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )
                )}
              </div>
            </div>
            <div className="col-span-1 px-6 py-4 text-sm font-medium text-gray-500 truncate relative group cursor-pointer hover:bg-gray-100 flex items-center justify-center"
              onClick={() => handleSort('responsible')}
            >
              <div className="flex items-center justify-center">
                <span className="block truncate pr-2">{t('tasks.responsible')}</span>
                {sortConfig.field === 'responsible' && (
                  sortConfig.direction === 'asc' ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )
                )}
              </div>
            </div>
            <div className="col-span-1 px-6 py-4 text-sm font-medium text-gray-500 truncate relative group cursor-pointer hover:bg-gray-100 flex items-center justify-center"
              onClick={() => handleSort('coworkers')}
            >
              <div className="flex items-center justify-center">
                <span className="block truncate pr-2">{t('tasks.coworkers')}</span>
                {sortConfig.field === 'coworkers' && (
                  sortConfig.direction === 'asc' ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )
                )}
              </div>
            </div>
            <div className="col-span-1 px-6 py-4 text-sm font-medium text-gray-500 truncate relative group cursor-pointer hover:bg-gray-100 flex items-center justify-center"
              onClick={() => handleSort('due_date')}
            >
              <div className="flex items-center justify-center">
                <span className="block truncate pr-2">{t('tasks.dueDate')}</span>
                {sortConfig.field === 'due_date' && (
                  sortConfig.direction === 'asc' ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )
                )}
              </div>
            </div>
            <div className="col-span-1 px-6 py-4 text-sm font-medium text-gray-500 truncate relative group cursor-pointer hover:bg-gray-100 flex items-center justify-center"
              onClick={() => handleSort('created_at' as SortField)}
            >
              <div className="flex items-center justify-center">
                <span className="block truncate pr-2">{t('tasks.creationDate')}</span>
                {sortConfig.field === 'created_at' && (
                  sortConfig.direction === 'asc' ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )
                )}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-8">
            {filteredTasks.map((task) => {
              const status = statuses.find((s) => s.id === task.status_id);
              if (!status) return null;
              return (
                <Task
                  key={task.id}
                  task={task}
                  status={status}
                  statuses={statuses}
                  projects={projects}
                  users={users}
                  onStatusChange={fetchTasks}
                  isSelected={selectedTasks.includes(task.id)}
                  onSelect={() => handleSelectTask(task.id)}
                />
              );
            })}
          </div>
        </div>
      )}
      {!isLoading && !error && filteredTasks.length > 0 && viewMode === 'kanban' && (
        <div className="bg-white rounded-xl shadow-lg border overflow-hidden">
          <KanbanBoard
            tasks={filteredTasks}
            statuses={statuses}
            users={users}
            onUpdate={fetchTasks}
          />
        </div>
      )}
    </div>
  );
}

export default Dashboard;