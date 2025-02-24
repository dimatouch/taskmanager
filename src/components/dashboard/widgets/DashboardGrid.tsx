import { useState, useEffect } from 'react';
import { Responsive, WidthProvider } from 'react-grid-layout';
import { Plus, CheckSquare, Calendar, Clock, AlertTriangle, ChevronRight } from 'lucide-react';
import { useCompany } from '../../../contexts/CompanyContext';
import { supabase } from '../../../lib/supabase';
import { cn } from '../../../lib/utils';
import { useNavigate } from 'react-router-dom';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

const ResponsiveGridLayout = WidthProvider(Responsive);

// WidgetWrapper Component
interface WidgetWrapperProps {
  title: string;
  onRemove: () => void;
  children: React.ReactNode;
}

function WidgetWrapper({ title, onRemove, children }: WidgetWrapperProps) {
  return (
    <div className="h-full bg-white rounded-lg shadow-sm p-4 border border-gray-100">
      {children}
    </div>
  );
}

// Widget Components
function ActiveTasksWidget() {
  const [data, setData] = useState([]);
  const navigate = useNavigate();
  const { currentCompany } = useCompany();
  
  useEffect(() => {
    // Fetch active tasks data
    const fetchData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: tasks } = await supabase
        .from('tasks')
        .select('status:task_statuses(name,color)')
        .eq('responsible_id', user.id)
        .is('result', null);

      if (tasks) {
        const statusCounts = tasks.reduce((acc, task) => {
          const status = task.status.name;
          acc[status] = (acc[status] || 0) + 1;
          return acc;
        }, {});

        setData(Object.entries(statusCounts).map(([id, value]) => ({
          id,
          value,
          color: tasks.find(t => t.status.name === id)?.status.color
        })));
      }
    };

    fetchData();
  }, []);

  return (
    <div className="h-full">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-medium">Активні завдання</h3>
        <button
          onClick={() => navigate(`/${currentCompany?.id}/tasks/my`)}
          className="text-xs text-indigo-600 hover:text-indigo-700"
        >
          Переглянути всі
        </button>
      </div>
      <div className="grid gap-3">
        {data.map(item => (
          <div 
            key={item.id}
            className="p-3 rounded-lg border bg-white hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => navigate(`/${currentCompany?.id}/tasks`)}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div 
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-sm font-medium">{item.id}</span>
              </div>
              <span className="text-lg font-semibold">{item.value}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TaskStatsWidget() {
  const [data, setData] = useState([]);
  const navigate = useNavigate();
  const { currentCompany } = useCompany();

  useEffect(() => {
    // Fetch task stats data
    const fetchData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: stats } = await supabase
        .from('user_statistics')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (stats) {
        setData([
          {
            id: 'Активні',
            value: stats.responsible_tasks - stats.completed_responsible_tasks,
            color: '#6366F1'
          },
          {
            id: 'Завершені',
            value: stats.completed_responsible_tasks,
            color: '#10B981'
          },
          {
            id: 'Прострочені',
            value: stats.overdue_tasks,
            color: '#EF4444'
          }
        ]);
      }
    };

    fetchData();
  }, []);

  return (
    <div className="h-full">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-medium">Статистика завдань</h3>
        <button
          onClick={() => navigate(`/${currentCompany?.id}/tasks/my`)}
          className="text-xs text-indigo-600 hover:text-indigo-700"
        >
          Деталі
        </button>
      </div>
      <div className="grid grid-cols-3 gap-4">
        {data.map(item => (
          <div 
            key={item.id}
            className="p-4 rounded-lg bg-white border hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => navigate(`/${currentCompany?.id}/tasks/my`)}
            style={{ borderColor: `${item.color}20` }}
          >
            <div className="text-2xl font-bold mb-1 tabular-nums" style={{ color: item.color }}>
              {item.value}
            </div>
            <div className="text-xs text-gray-600">{item.id}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function QuickTaskWidget() {
  const [recentTasks, setRecentTasks] = useState([]);
  const navigate = useNavigate();
  const { currentCompany } = useCompany();

  useEffect(() => {
    // Fetch quick task data
    const fetchData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: tasks } = await supabase
        .from('tasks')
        .select('id, title, created_at')
        .eq('owner_id', user.id)
        .order('created_at', { ascending: false })
        .limit(3);

      setRecentTasks(tasks || []);
    };

    fetchData();
  }, []);

  return (
    <div className="h-full">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-medium">Останні завдання</h3>
        <button
          onClick={() => navigate(`/${currentCompany?.id}/tasks/created`)}
          className="text-xs text-indigo-600 hover:text-indigo-700"
        >
          Всі завдання
        </button>
      </div>
      <div className="space-y-3">
        {recentTasks.map(task => (
          <div 
            key={task.id}
            className="p-3 rounded-lg border bg-white hover:shadow-md transition-shadow cursor-pointer flex items-center justify-between"
            onClick={() => navigate(`/${currentCompany?.id}/tasks/${task.id}`)}
          >
            <div className="flex items-center gap-2">
              <CheckSquare className="w-4 h-4 text-indigo-600" />
              <span className="text-xs font-medium truncate flex-1">{task.title}</span>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-400" />
          </div>
        ))}
      </div>
    </div>
  );
}

function UpcomingDeadlinesWidget() {
  const [deadlines, setDeadlines] = useState([]);
  const navigate = useNavigate();
  const { currentCompany } = useCompany();

  useEffect(() => {
    // Fetch upcoming deadlines data
    const fetchData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const now = new Date();
      const weekEnd = new Date(now);
      weekEnd.setDate(now.getDate() + 7);

      const { data: tasks } = await supabase
        .from('tasks')
        .select('id, title, due_date')
        .eq('responsible_id', user.id)
        .is('result', null)
        .gte('due_date', now.toISOString())
        .lte('due_date', weekEnd.toISOString())
        .order('due_date');

      setDeadlines(tasks || []);
    };

    fetchData();
  }, []);

  return (
    <div className="h-full">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-medium">Дедлайни на тиждень</h3>
        <button
          onClick={() => navigate(`/${currentCompany?.id}/tasks/my`)}
          className="text-xs text-indigo-600 hover:text-indigo-700"
        >
          Всі дедлайни
        </button>
      </div>
      <div className="space-y-3">
        {deadlines.map(task => (
          <div 
            key={task.id}
            className="p-3 rounded-lg border bg-white hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => navigate(`/${currentCompany?.id}/tasks/${task.id}`)}
          >
            <div className="flex items-center justify-between h-6">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xs font-medium truncate flex-1">{task.title}</span>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Calendar className="w-4 h-4 text-gray-400" />
                <span className="text-xs text-gray-500 tabular-nums">
                  {new Date(task.due_date).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>
        ))}
        {deadlines.length === 0 && (
          <div className="text-center py-4 text-gray-500">
            Немає найближчих дедлайнів
          </div>
        )}
      </div>
    </div>
  );
}

function MyIdeasWidget() {
  return (
    <div className="h-full">
      <div className="flex flex-col h-full">
        <h3 className="text-base mb-4">Мої дзвінки</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-sm text-gray-500 mb-2">Сьогодні</div>
            <div className="flex gap-6">
              <div>
                <span className="text-2xl font-bold text-yellow-500">0</span>
              </div>
              <div>
                <span className="text-2xl font-bold text-blue-500">0</span>
              </div>
            </div>
          </div>
          <div>
            <div className="text-sm text-gray-500 mb-2">Цей тиждень</div>
            <div className="flex gap-6">
              <div>
                <span className="text-2xl font-bold text-yellow-500">0</span>
              </div>
              <div>
                <span className="text-2xl font-bold text-blue-500">0</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TaskProgressWidget() {
  return (
    <div className="h-full">
      <div className="flex flex-col h-full">
        <h3 className="text-base mb-4">Завершені завдання</h3>
        <div className="flex items-center mb-4">
          <span className="text-3xl font-bold text-green-500">0</span>
          <span className="text-base text-gray-500 ml-2">/0</span>
        </div>
        <div className="flex-1">
          <div className="grid grid-cols-5 gap-2 text-center text-sm text-gray-500">
            <div>ПТ</div>
            <div>СБ</div>
            <div>НД</div>
            <div>ПН</div>
            <div>ВТ</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Types and Constants
interface GridItem {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
}

interface Widget {
  type: string;
  size: 'small' | 'medium' | 'large';
}

const WIDGET_SIZES = {
  active_tasks: { w: 6, h: 3 },
  upcoming_deadlines: { w: 6, h: 3 },
  quick_task: { w: 6, h: 2 },
  task_stats: { w: 6, h: 2 },
  task_progress: { w: 6, h: 2 },
  my_ideas: { w: 6, h: 2 }
};

const DEFAULT_LAYOUTS = {
  lg: [
    { i: 'task_stats', x: 0, y: 0, w: 12, h: 2 },
    { i: 'active_tasks', x: 0, y: 2, w: 6, h: 4 },
    { i: 'upcoming_deadlines', x: 6, y: 2, w: 6, h: 4 },
    { i: 'quick_task', x: 0, y: 6, w: 12, h: 3 }
  ],
  md: [
    { i: 'task_stats', x: 0, y: 0, w: 12, h: 2 },
    { i: 'active_tasks', x: 0, y: 2, w: 12, h: 4 },
    { i: 'upcoming_deadlines', x: 0, y: 6, w: 12, h: 4 },
    { i: 'quick_task', x: 0, y: 10, w: 12, h: 3 }
  ],
  sm: [
    { i: 'task_stats', x: 0, y: 0, w: 6, h: 2 },
    { i: 'active_tasks', x: 0, y: 2, w: 6, h: 4 },
    { i: 'upcoming_deadlines', x: 0, y: 6, w: 6, h: 4 },
    { i: 'quick_task', x: 0, y: 10, w: 6, h: 3 }
  ]
};

const DEFAULT_WIDGETS: Widget[] = [
  { type: 'active_tasks', size: 'large' },
  { type: 'upcoming_deadlines', size: 'medium' },
  { type: 'quick_task', size: 'small' },
  { type: 'task_stats', size: 'medium' }
];

const AVAILABLE_WIDGETS = [
  {
    type: 'active_tasks',
    title: 'Active Tasks',
    description: 'View and manage your current active tasks'
  },
  {
    type: 'upcoming_deadlines',
    title: 'Upcoming Deadlines',
    description: 'See tasks with approaching deadlines'
  },
  {
    type: 'quick_task',
    title: 'Quick Task',
    description: 'Quickly create new tasks'
  },
  {
    type: 'task_stats',
    title: 'Task Statistics',
    description: 'View your task completion statistics'
  },
  {
    type: 'task_progress',
    title: 'Task Progress',
    description: 'Track your overall task progress'
  },
  {
    type: 'my_ideas',
    title: 'My Ideas',
    description: 'Manage your ideas and notes'
  }
];

// Main Component
export function DashboardGrid() {
  const { currentCompany } = useCompany();
  const [layouts, setLayouts] = useState<{ [key: string]: GridItem[] }>({
    lg: DEFAULT_LAYOUTS.lg,
    md: DEFAULT_LAYOUTS.md,
    sm: DEFAULT_LAYOUTS.sm
  });
  const [widgets, setWidgets] = useState<Widget[]>(DEFAULT_WIDGETS);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddWidget, setShowAddWidget] = useState(false);

  useEffect(() => {
    if (currentCompany) {
      loadDashboardSettings();
    }
  }, [currentCompany]);

  const loadDashboardSettings = async () => {
    try {
      if (!currentCompany) {
        throw new Error('No current company selected');
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('No authenticated user');
      }

      const { data: settings, error } = await supabase
        .from('user_dashboard_settings')
        .select('widgets, layout')
        .eq('user_id', user.id)
        .eq('company_id', currentCompany.id)
        .maybeSingle();

      if (error) {
        console.error('Error loading dashboard settings:', error);
        return;
      }

      if (settings) {
        const savedWidgets = settings.widgets || DEFAULT_WIDGETS;
        setWidgets(savedWidgets);

        let savedLayout = settings.layout || DEFAULT_LAYOUTS.lg;
        let layoutArray: any[] = [];

        if (Array.isArray(savedLayout)) {
          layoutArray = savedLayout;
        } else if (typeof savedLayout === 'string') {
          try {
            layoutArray = JSON.parse(savedLayout);
          } catch (e) {
            console.error("Failed to parse savedLayout string:", e);
            layoutArray = DEFAULT_LAYOUTS.lg;
          }
        } else if (typeof savedLayout === 'object' && savedLayout !== null) {
          layoutArray = Object.values(savedLayout);
        } else {
          layoutArray = DEFAULT_LAYOUTS.lg;
        }

        const layoutItems = layoutArray.map((item: any) => ({
          ...item,
          minW: 2,
          minH: 2
        }));

        setLayouts({
          lg: layoutItems,
          md: layoutItems.map(item => ({ ...item, w: Math.min(item.w, 6) })),
          sm: layoutItems.map(item => ({ ...item, w: Math.min(item.w, 6) }))
        });
      } else {
        const { error: insertError } = await supabase
        .from('user_dashboard_settings')
          .insert({
            user_id: user.id,
            company_id: currentCompany.id,
            widgets: DEFAULT_WIDGETS,
            layout: DEFAULT_LAYOUTS.lg
          });

        if (insertError) {
          console.error('Failed to create dashboard settings:', insertError);
          return;
        }

        setWidgets(DEFAULT_WIDGETS);
        setLayouts({
          lg: DEFAULT_LAYOUTS.lg,
          md: DEFAULT_LAYOUTS.md,
          sm: DEFAULT_LAYOUTS.sm
        });
      }
    } catch (err) {
      console.error('Failed to load dashboard settings:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLayoutChange = async (currentLayout: GridItem[]) => {
    try {
      const { data: { user } } = await supabase.auth.getUser(); 
      if (!user) {
        console.error('No authenticated user');
        return;
      }
      if (!currentCompany) {
        console.error('No current company selected');
        return;
      }

      setLayouts({ lg: currentLayout });

      const layoutObj = currentLayout.reduce((acc, item) => {
        const size = WIDGET_SIZES[item.i] || { w: item.w, h: item.h };
        acc[item.i] = {
          x: item.x,
          y: item.y,
          w: size.w,
          h: size.h
        };
        return acc;
      }, {} as Record<string, { x: number; y: number; w: number; h: number }>);

      const { error: updateError } = await supabase
        .from('user_dashboard_settings')
        .update({ layout: layoutObj })
        .eq('user_id', user.id)
        .eq('company_id', currentCompany.id);

      if (updateError) throw updateError;
    } catch (err) {
      console.error('Failed to save layout:', err);
    }
  };

  const renderWidget = (widget: Widget) => {
    switch (widget.type) {
      case 'active_tasks':
        return <ActiveTasksWidget />;
      case 'upcoming_deadlines':
        return <UpcomingDeadlinesWidget />;
      case 'quick_task':
        return <QuickTaskWidget />;
      case 'task_stats':
        return <TaskStatsWidget />;
      case 'task_progress':
        return <TaskProgressWidget />;
      case 'my_ideas':
        return <MyIdeasWidget />;
      default:
        return null;
    }
  };

  const handleAddWidget = async (type: string) => {
    try {
      if (!currentCompany) {
        throw new Error('No current company selected');
      }

      const size = WIDGET_SIZES[type];
      if (!size) {
        throw new Error(`Invalid widget type: ${type}`);
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('No authenticated user');
      }

      const newWidget = { type, size: 'medium' };
      const newWidgets = [...widgets, newWidget];
      
      const lastLayoutItem = layouts.lg[layouts.lg.length - 1];
      const y = lastLayoutItem ? lastLayoutItem.y + lastLayoutItem.h : 0;
      const x = size.w === 12 ? 0 : (lastLayoutItem ? lastLayoutItem.x : 0);

      const newLayoutItem: GridItem = {
        i: type,
        x,
        y,
        w: size.w,
        h: size.h,
        minW: 2,
        minH: 2
      };

      const newLayout = [...layouts.lg, newLayoutItem];

      const { data: existingSettings } = await supabase
        .from('user_dashboard_settings')
        .select()
        .eq('user_id', user.id)
        .single();

      if (existingSettings) {
        const { error: updateError } = await supabase
          .from('user_dashboard_settings')
          .update({ 
            widgets: newWidgets,
            layout: newLayout,
            company_id: currentCompany.id
          })
          .eq('user_id', user.id);
        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from('user_dashboard_settings')
          .insert({
            user_id: user.id,
            widgets: newWidgets,
            layout: newLayout
          });
        if (insertError) throw insertError;
      }

      setWidgets(newWidgets);
      setLayouts({ lg: newLayout });
      setShowAddWidget(false);
    } catch (err) {
      console.error('Failed to add widget:', err);
    }
  };

  const handleRemoveWidget = async (type: string) => {
    try {
      const newWidgets = widgets.filter(w => w.type !== type);
      const newLayout = layouts.lg.filter(item => item.i !== type);
      
      const user = (await supabase.auth.getUser()).data.user;
      if (user) {
        await supabase
          .from('user_dashboard_settings')
          .update({ widgets: newWidgets, layout: newLayout })
          .eq('user_id', user.id);
      }

      setWidgets(newWidgets);
      setLayouts({ lg: newLayout });
    } catch (err) {
      console.error('Failed to remove widget:', err);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    );
  }

  return (
    <div className={cn(
      "relative min-h-[calc(100vh-4rem)] bg-gray-50 w-full",
      "py-4 px-2 mx-auto",
      "!max-w-none"
    )}>
      <button
        onClick={() => setShowAddWidget(true)}
        className={cn(
          "fixed bottom-8 right-8 px-6 py-3 rounded-full",
          "bg-gradient-to-r from-indigo-500 to-indigo-600",
          "text-white shadow-lg hover:shadow-xl",
          "hover:from-indigo-600 hover:to-indigo-700",
          "flex items-center gap-2 transition-all transform hover:scale-105 z-[70]"
        )}
      >
        <Plus className="w-5 h-5" />
        <span className="font-medium">Add Widget</span>
      </button>

      {showAddWidget && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-[2px] flex items-center justify-center p-4 z-[80]">
          <div className="bg-white rounded-lg shadow-xl max-w-xl w-full p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center">
                <Plus className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <h3 className="text-base font-medium text-gray-900">Add Widget</h3>
                <p className="text-xs text-gray-500">Choose a widget to add to your dashboard</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {AVAILABLE_WIDGETS
                .filter(widget => !widgets.find(existing => existing.type === widget.type))
                .map(widget => (
                  <button
                    key={widget.type}
                    onClick={() => handleAddWidget(widget.type)}
                    className={cn(
                      "p-4 rounded-lg border border-gray-200",
                      "hover:border-indigo-500 hover:bg-indigo-50",
                      "transition-all duration-200",
                      "flex flex-col items-start gap-2",
                      "group relative"
                    )}
                  >
                    <h4 className="font-medium text-gray-900 group-hover:text-indigo-600">
                      {widget.title}
                    </h4>
                    <p className="text-sm text-gray-500">{widget.description}</p>
                  </button>
                ))}
            </div>
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowAddWidget(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-800"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <ResponsiveGridLayout
        className="layout w-full"
        layouts={layouts}
        breakpoints={{ lg: 1920, md: 1280, sm: 768 }}
        cols={{ lg: 12, md: 12, sm: 6 }}
        rowHeight={100}
        margin={[16, 16]}
        containerPadding={[16, 0]}
        onLayoutChange={(layout) => handleLayoutChange(layout)}
        isDraggable={false}
        isResizable={false}
        compactType="vertical"
        preventCollision={false}
        useCSSTransforms={true}
      >
        {widgets.map((widget) => (
          <div key={widget.type}>
            <WidgetWrapper
              title={AVAILABLE_WIDGETS.find(w => w.type === widget.type)?.title || ''}
              onRemove={() => handleRemoveWidget(widget.type)}
            >
              {renderWidget(widget)}
            </WidgetWrapper>
          </div>
        ))}
      </ResponsiveGridLayout>
    </div>
  );
}

export default DashboardGrid;