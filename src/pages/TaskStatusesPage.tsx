import { TaskStatusList } from '../components/dashboard/TaskStatusList';

export function TaskStatusesPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-8">Task Status Settings</h1>
      <TaskStatusList />
    </div>
  );
}