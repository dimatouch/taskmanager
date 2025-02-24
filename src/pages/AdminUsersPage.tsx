import { useState } from 'react';
import { Plus } from 'lucide-react';
import { UserList } from '../components/auth/UserList';
import { UserManagement } from '../components/auth/UserManagement';
import { useTranslation } from '../lib/i18n/useTranslation';
import { cn } from '../lib/utils';

export function AdminUsersPage() {
  const { t } = useTranslation();
  const [isAddingUser, setIsAddingUser] = useState(false);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('admin.userManagement')}</h1>
          <p className="mt-1 text-sm text-gray-500">
            {t('admin.userManagementSubtitle')}
          </p>
        </div>
        <button
          onClick={() => setIsAddingUser(true)}
          className={cn(
            "inline-flex items-center px-4 py-2 rounded-lg transition-all duration-200",
            "bg-gradient-to-r from-indigo-500 to-indigo-600 text-white",
            "hover:from-indigo-600 hover:to-indigo-700",
            "shadow-sm hover:shadow"
          )}
        >
          <Plus className="w-5 h-5 mr-2" />
          {t('admin.addUser')}
        </button>
      </div>

      <div className="space-y-6">
        <UserList />
      </div>

      {/* Add User Modal */}
      {isAddingUser && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-[2px] flex items-start justify-center p-4 z-[60] animate-in fade-in duration-200">
          <div className="w-full max-w-md mt-[10vh]">
            <UserManagement
              onSuccess={() => {
                setIsAddingUser(false);
              }}
              onCancel={() => setIsAddingUser(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}