import { X, Plus, ChevronUp } from 'lucide-react';
import { useForm, SubmitHandler } from 'react-hook-form';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCompany } from '../../../../contexts/CompanyContext';
import { TaskViewers } from './TaskViewers';
import { FormData } from '../types';
import { cn } from '../../../../lib/utils';
import { useTranslation } from '../../../../lib/i18n/useTranslation';
import { supabase } from '../../../../lib/supabase';

interface TaskHeaderProps {
  onClose: () => void;
  isSubtask?: boolean;
  errors: any;
  task: {
    id: string;
    title: string;
    is_subtask: boolean;
    parent_id: string | null;
  };
  users: { id: string; email: string }[];
  isQuickTaskOpen: boolean;
  setIsQuickTaskOpen: (open: boolean) => void;
}

export function TaskHeader({
  onClose,
  isSubtask,
  task,
  users,
  errors,
  isQuickTaskOpen,
  setIsQuickTaskOpen,
}: TaskHeaderProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { currentCompany } = useCompany();

  // Використовуємо react-hook-form для керування полем title
  const { register, handleSubmit, watch } = useForm<FormData>({
    defaultValues: {
      title: task.title,
    },
  });

  // Режим редагування заголовку
  const [isEditingTitle, setIsEditingTitle] = useState(false);

  // Функція збереження, що оновлює заголовок в Supabase
  const onSubmit: SubmitHandler<FormData> = async (data) => {
    try {
      const { error } = await supabase
        .from('tasks')
        .update({ title: data.title })
        .eq('id', task.id);
      if (error) throw error;
      console.log('Title updated successfully');
    } catch (err) {
      console.error('Failed to update title:', err);
    }
  };

  return (
    <form className="p-4 border-b flex justify-center relative">
      {/* Відображення користувачів */}
      <TaskViewers task={task} users={users} />

      <div className="flex-1 max-w-[1200px] mx-auto px-12">
        {isEditingTitle ? (
          <input
            autoFocus
            {...register('title')}
            onBlur={() => {
              // При втраті фокусу зберігаємо зміни та виходимо з режиму редагування
              handleSubmit(onSubmit)();
              setIsEditingTitle(false);
            }}
            className="flex-1 text-xl font-medium bg-transparent border-0 p-0 focus:ring-0 focus:outline-none break-words whitespace-pre-wrap"
            style={{ wordBreak: 'break-word' }}
          />
        ) : (
          <h1
            className="text-xl font-medium text-gray-900 cursor-pointer hover:bg-gray-50/50 rounded px-2 py-1 break-words whitespace-pre-wrap"
            style={{ wordBreak: 'break-word' }}
            onClick={() => setIsEditingTitle(true)}
          >
            {watch('title') ||
              (isSubtask ? t('tasks.taskDetails.subtasks') : t('tasks.taskTitle'))}
          </h1>
        )}
      </div>

      {/* Блок кнопок праворуч */}
      <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
        <button
          type="button"
          onClick={() => navigate(`/${currentCompany?.id}/tasks/new`)}
          className={cn(
            "flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg transition-all",
            "bg-gray-100 text-gray-600 hover:bg-gray-200 shadow-sm"
          )}
        >
          <Plus className="w-4 h-4" />
          <span className="font-medium">Save & Add New Task</span>
        </button>
        {task.is_subtask && task.parent_id && (
          <button
            type="button"
            onClick={() => {
              if (currentCompany) {
                navigate(`/${currentCompany.id}/tasks/${task.parent_id}`);
              }
            }}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg transition-all",
              "bg-gray-100 text-gray-600 hover:bg-gray-200 shadow-sm"
            )}
          >
            <ChevronUp className="w-4 h-4 mr-1" />
            <span className="font-medium">До головного завдання</span>
          </button>
        )}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
    </form>
  );
}
