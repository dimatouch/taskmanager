import React, { useState, useRef, useEffect } from 'react';
import { CheckSquare, MoreVertical, Trash2, Plus, Check } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { TaskStatus } from './types';

interface TaskSelectionProps {
  selectedTasks: string[];
  onSelectAll: () => void;
  onBulkDelete: () => void;
  onBulkStatusChange: (statusId: string) => void;
  statuses: TaskStatus[];
  isDeleting: boolean;
  isUpdatingStatus: boolean;
  totalTasks: number;
}

export function TaskSelection({ 
  selectedTasks, 
  onSelectAll, 
  onBulkDelete,
  onBulkStatusChange,
  statuses,
  isDeleting,
  isUpdatingStatus,
  totalTasks 
}: TaskSelectionProps) {
  const [showActions, setShowActions] = useState(false);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const actionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (actionsRef.current && !actionsRef.current.contains(e.target as Node)) {
        setShowActions(false);
        setShowStatusDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative flex items-center gap-2" ref={actionsRef}>
      <button 
        onClick={onSelectAll}
        className={cn(
          "w-4 h-4 rounded border transition-colors",
          selectedTasks.length > 0 
            ? "bg-indigo-500 border-indigo-500" 
            : "border-gray-300 hover:border-indigo-500"
        )}
      >
        {selectedTasks.length > 0 && (
          <Check className="w-3 h-3 text-white" />
        )}
      </button>

      {selectedTasks.length > 0 && (
        <>
          <span className="text-xs text-gray-500">
            {selectedTasks.length} of {totalTasks} selected
          </span>

          <div className="relative">
            <button
              onClick={() => setShowActions(!showActions)}
              className={cn(
                "p-1 rounded-lg transition-colors",
                "text-gray-400 hover:text-gray-600 hover:bg-gray-100"
              )}
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {showActions && (
              <div className="absolute top-full left-0 mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                {/* Change Status Option */}
                <div className="relative">
                  <button
                    onClick={() => setShowStatusDropdown(!showStatusDropdown)}
                    disabled={isUpdatingStatus}
                    className={cn(
                      "w-full px-3 py-2 text-sm text-left hover:bg-gray-50 flex items-center justify-between",
                      "disabled:opacity-50 disabled:cursor-not-allowed"
                    )}
                  >
                    <span className="flex items-center">
                      <Plus className="w-4 h-4 mr-2" />
                      Change Status
                    </span>
                    {isUpdatingStatus && (
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-indigo-500 border-t-transparent" />
                    )}
                  </button>

                  {showStatusDropdown && (
                    <div className="absolute left-full top-0 ml-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1">
                      {statuses.map(status => (
                        <button
                          key={status.id}
                          onClick={() => {
                            onBulkStatusChange(status.id);
                            setShowStatusDropdown(false);
                            setShowActions(false);
                          }}
                          className="w-full px-3 py-2 text-sm text-left hover:bg-gray-50 flex items-center gap-2"
                        >
                          <div 
                            className="w-3 h-3 rounded-full" 
                            style={{ backgroundColor: status.color }} 
                          />
                          {status.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Delete Option */}
                <button
                  onClick={() => {
                    onBulkDelete();
                    setShowActions(false);
                  }}
                  disabled={isDeleting}
                  className={cn(
                    "w-full px-3 py-2 text-sm text-left hover:bg-red-50 text-red-600 hover:text-red-700 flex items-center",
                    "disabled:opacity-50 disabled:cursor-not-allowed"
                  )}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Selected
                  {isDeleting && (
                    <div className="ml-2 animate-spin rounded-full h-4 w-4 border-2 border-red-500 border-t-transparent" />
                  )}
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}