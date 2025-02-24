import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { KanbanTask } from './KanbanTask';
import type { Task, TaskStatus } from './types';
import { cn } from '../../lib/utils';

interface KanbanColumnProps {
  status: TaskStatus;
  tasks: Task[];
  users: { id: string; email: string }[];
}

export function KanbanColumn({ status, tasks, users }: KanbanColumnProps) {
  const { setNodeRef } = useDroppable({
    id: status.id,
    data: {
      statusId: status.id,
      type: 'column',
    },
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex flex-col w-80 rounded-lg bg-gray-50/80 border border-gray-200",
        "hover:border-gray-300 transition-colors"
      )}
    >
      {/* Column Header */}
      <div className="p-2 border-b bg-white rounded-t-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: status.color }}
            />
            <h3 className="text-sm font-medium text-gray-900">
              {status.name}
            </h3>
          </div>
          <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
            {tasks.length}
          </span>
        </div>
      </div>

      {/* Tasks List */}
      <div className="flex-1 p-2 space-y-2 min-h-[200px]">
        <SortableContext
          items={tasks.map(t => t.id)}
          strategy={verticalListSortingStrategy}
        >
          {tasks.map(task => (
            <KanbanTask key={task.id} task={task} users={users} />
          ))}
        </SortableContext>
      </div>
    </div>
  );
}