import { useState, useEffect } from 'react';
import { DndContext, DragOverlay, useSensor, useSensors, PointerSensor } from '@dnd-kit/core';
import { SortableContext, arrayMove } from '@dnd-kit/sortable';
import { KanbanColumn } from './KanbanColumn';
import { KanbanTask } from './KanbanTask';
import { supabase } from '../../lib/supabase';
import type { Task, TaskStatus } from './types';
import { cn } from '../../lib/utils';

interface KanbanBoardProps {
  tasks: Task[];
  statuses: TaskStatus[];
  users: { id: string; email: string }[];
  onUpdate: (updatedTasks: Task[]) => void;
}

export function KanbanBoard({ tasks, statuses, users, onUpdate }: KanbanBoardProps) {
  const [columns, setColumns] = useState<{ [key: string]: Task[] }>({});
  const [activeTask, setActiveTask] = useState<Task | null>(null);

  // Initialize sensors for drag and drop
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  // Group tasks by status
  useEffect(() => {
    const grouped = tasks.reduce((acc, task) => {
      const statusId = task.status_id;
      if (!acc[statusId]) {
        acc[statusId] = [];
      }
      acc[statusId].push(task);
      return acc;
    }, {} as { [key: string]: Task[] });

    setColumns(grouped);
  }, [tasks]);

  const handleDragEnd = async (event: any) => {
    const { active, over } = event;
    if (!active || !over) return;

    const activeId = active.id;
    const overId = over.id;

    const task = tasks.find(t => t.id === activeId);
    if (!task) {
      console.error('Task not found:', activeId);
      return;
    }

    let newStatusId: string;

    if (over.data.current?.type === 'task') {
      const overTask = tasks.find(t => t.id === overId);
      if (!overTask) {
        console.error('Target task not found:', overId);
        return;
      }
      newStatusId = overTask.status_id;
    } else if (over.data.current?.type === 'column') {
      newStatusId = overId;
    } else {
      console.error('Invalid drop target type');
      return;
    }

    if (task.status_id !== newStatusId) {
      try {
        const { error } = await supabase
          .from('tasks')
          .update({
            status_id: newStatusId,
            updated_at: new Date().toISOString()
          })
          .eq('id', task.id);

        if (error) {
          console.error('Failed to update task status:', error);
          throw error;
        }
        
        // Call onUpdate to refresh parent
        onUpdate();
      } catch (err) {
        console.error('Failed to update task status:', err);
      }
    }
    
    // Reset active task after drag ends
    setActiveTask(null);
  };

  return (
    <div className="h-full overflow-x-auto">
      <DndContext
        sensors={sensors}
        onDragStart={(event) => {
          const task = tasks.find(t => t.id === event.active.id);
          if (task) setActiveTask(task);
        }}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 p-4 min-w-fit">
          {statuses.map(status => (
            <KanbanColumn
              key={status.id}
              status={status}
              users={users}
              tasks={columns[status.id] || []}
            />
          ))}
        </div>

        <DragOverlay>
          {activeTask && (
            <div className="transform-none">
              <KanbanTask task={activeTask} users={users} />
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </div>
  );
}