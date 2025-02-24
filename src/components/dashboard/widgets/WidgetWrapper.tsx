import { EyeOff, GripVertical } from 'lucide-react';
import { cn } from '../../../lib/utils';

interface WidgetWrapperProps {
  title: string;
  children: React.ReactNode;
  onRemove?: () => void;
}

export function WidgetWrapper({ title, children, onRemove }: WidgetWrapperProps) {
  return (
    <div className={cn(
      "flex flex-col h-full transition-all duration-300 bg-gradient-to-br from-white to-gray-50/80"
    )}>
      <div className="flex items-center justify-between px-4 py-3 border-b bg-white group">
        <div className="flex items-center gap-2 cursor-move" data-grid-handle>
          <GripVertical className="w-4 h-4 text-gray-400" />
          <h3 className="text-sm font-medium text-gray-700">
            {title.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
          </h3>
        </div>
        {onRemove && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            className={cn(
              "p-1.5 rounded-lg transition-colors",
              "text-gray-400 hover:text-gray-600 hover:bg-gray-100",
              "group-hover:opacity-100 opacity-0"
            )}
            title="Hide Widget"
          >
            <EyeOff className="w-4 h-4" />
          </button>
        )}
      </div>
      <div className="flex-1 overflow-hidden relative">
        {children}
      </div>
    </div>
  );
}