import { UserManagement } from '../components/auth/UserManagement';
import { UserList } from '../components/auth/UserList';

export function UsersPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-8">User Management</h1>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div>
          <UserManagement />
        </div>
        <div>
          <UserList />
        </div>
      </div>
    </div>
  );
}