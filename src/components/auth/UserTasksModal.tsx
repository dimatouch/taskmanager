import { Calendar } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '../../lib/utils';

interface UserTasksModalProps {
  isOpen: boolean;
  onClose: () => void;
  tasks: any[];
  type: 'responsible' | 'coworker';
  title: string;
}

export function UserTasksModal({ isOpen, onClose, tasks, type, title }: UserTasksModalProps) {
  const navigate = useNavigate();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-[2px] flex items-start justify-center p-4 z-[60] animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-white rounded-lg shadow-xl mt-16">
        <div className="p-4 flex items-center justify-between border-b">
          <h2 className="text-lg font-medium text-gray-900">{title}</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-4 max-h-[70vh] overflow-y-auto">
          <div className="space-y-4">
            {tasks.length > 0 ? (
              tasks.map(task => (
                <div
                  key={task.id}
                  onClick={() => {
                    navigate(`/tasks/${task.id}`);
                    onClose();
                  }}
                  className="bg-white rounded-lg border shadow-sm hover:shadow-md transition-shadow cursor-pointer p-4"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-medium text-gray-900">{task.title}</h3>
                    <div
                      className="px-3 py-1 rounded-full text-sm font-medium"
                      style={{
                        backgroundColor: task.status.color,
                        color: 'white',
                        textShadow: '0 1px 2px rgba(0,0,0,0.1)'
                      }}
                    >
                      {task.status.name}
                    </div>
                  </div>
                  {task.due_date && (
                    <div className="mt-2 text-sm text-gray-500">
                      <Calendar className="w-4 h-4 inline-block mr-1" />
                      Due {new Date(task.due_date).toLocaleDateString()}
                    </div>
                  )}
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-500 text-center py-4">
                {type === 'responsible' 
                  ? 'Not responsible for any tasks'
                  : 'Not a co-worker on any tasks'
                }
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}