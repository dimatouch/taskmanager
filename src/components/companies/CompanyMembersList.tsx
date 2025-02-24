import { useState, useEffect } from 'react';
import {
  Users,
  Shield,
  UserPlus,
  Mail,
  Loader2,
  CheckCircle2,
  AlertCircle,
  X,
  ChevronDown,
  User,
  Plus
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { cn } from '../../lib/utils';
import { userService } from '../../services/userService';

interface CompanyMembersListProps {
  company: {
    id: string;
    name: string;
  };
  onUpdate?: () => void;
}

interface Member {
  user_id: string;
  role: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
}

export function CompanyMembersList({ company, onUpdate }: CompanyMembersListProps) {
  const [members, setMembers] = useState<Member[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentUser, setCurrentUser] = useState<{ id: string; role: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [newUser, setNewUser] = useState({
    email: '',
    password: '',
    first_name: '',
    last_name: '',
    role: 'member'
  });

  useEffect(() => {
    fetchMembers();
    fetchCurrentUser();
  }, [company.id]);

const fetchCurrentUser = async () => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Забираємо single() / maybeSingle()
    const { data: result, error } = await supabase
      .from('company_members')
      .select('role')
      .eq('company_id', company.id)
      .eq('user_id', user.id);

    if (error) {
      console.error('Failed to fetch current user role:', error);
      return;
    }

    // Якщо рядків 0 => користувач не в company
    if (!result || result.length === 0) {
      console.log('No membership found');
      return;
    }

    // Якщо рядків >= 1 — беремо перший
    setCurrentUser({ id: user.id, role: result[0].role });

  } catch (err) {
    console.error('Failed to fetch current user:', err);
  }
};

  const fetchMembers = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const { data: members, error } = await supabase
        .from('company_member_profiles')
        .select('*')
        .eq('company_id', company.id)
        .order('role', { ascending: true });

      if (error) throw error;
      setMembers(members || []);
    } catch (err) {
      console.error('Failed to fetch members:', err);
      setError(err instanceof Error ? err.message : 'Failed to load members');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveMember = async (userId: string | undefined) => {
    if (!userId) {
      console.error('handleRemoveMember: userId is undefined');
      setError('Invalid user ID');
      return;
    }
    try {
      setIsDeleting(userId);
      setError(null);

      // Не дозволяємо видалити власника компанії
      const member = members.find(m => m.user_id === userId);
      if (member?.role === 'owner') {
        throw new Error('Cannot remove company owner');
      }

      const { error: deleteError } = await supabase
        .from('company_members')
        .delete()
        .eq('user_id', userId);
      if (deleteError) throw deleteError;

      setMembers(prev => prev.filter(u => u.user_id !== userId));
      onUpdate?.();
    } catch (err) {
      console.error('Failed to delete user:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete user');
    } finally {
      setIsDeleting(null);
    }
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      // Тільки власники компанії можуть змінювати ролі
      if (currentUser?.role !== 'owner') {
        throw new Error('Only company owners can change roles');
      }

      // Не змінюємо роль власника
      const member = members.find(m => m.user_id === userId);
      if (member?.role === 'owner') {
        throw new Error('Cannot change owner\'s role');
      }

      const { error } = await supabase
        .from('company_members')
        .update({ role: newRole })
        .eq('company_id', company.id)
        .eq('user_id', userId);
      if (error) throw error;
      fetchMembers();
    } catch (err) {
      console.error('Failed to update role:', err);
    }
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      setError(null);

      // Check if user exists by email
      const { data: existingProfile, error: profileError } = await supabase
        .from('user_profiles')
        .select('user_id')
        .eq('email', newUser.email)
        .single();

      if (profileError && profileError.code !== 'PGRST116') {
        // PGRST116 means no rows returned, which is expected for new users
        throw profileError;
      }

      if (existingProfile?.user_id) {
        // Check if already a member
        const { data: existingMember, error: memberError } = await supabase
          .from('company_members')
          .select('*')
          .eq('company_id', company.id)
          .eq('user_id', existingProfile.user_id)
          .maybeSingle();

        if (memberError) {
          throw memberError;
        }

        if (existingMember) {
          throw new Error('User is already a member of this company');
        }

        // For existing users, we'll let the trigger handle company_members creation

        // Let the database trigger handle member creation
        // No need to explicitly create company_members entry
      }

      // If user doesn't exist, create new through Auth API
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: newUser.email,
        password: newUser.password,
        options: {
          data: {
            first_name: newUser.first_name,
            last_name: newUser.last_name,
            created_by: currentUser?.id,
            role: newUser.role,
            company_id: company.id
          }
        }
      });

      if (signUpError) throw signUpError;
      if (!signUpData.user) throw new Error('Failed to create user');

      // Reset form and close modal
      setNewUser({ email: '', password: '', first_name: '', last_name: '', role: 'member' });
      setIsAddingUser(false);
      fetchMembers();
      onUpdate?.();
    } catch (err) {
      console.error('Failed to add member:', err);
      if (err instanceof Error) {
        // Handle specific error cases
        if (err.message.includes('duplicate key value')) {
          setError('User is already a member of this company');
        } else {
          setError(err.message);
        }
      } else {
        setError('Failed to add member');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-lg border p-6">
        <div className="flex items-center justify-center h-32">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-lg border overflow-hidden">
        <div className="p-6 space-y-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center">
                  <Users className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <h2 className="text-lg font-medium text-gray-900">Company Members</h2>
                  <p className="text-sm text-gray-500">Manage members and their roles</p>
                </div>
              </div>
              <button
                onClick={() => setIsAddingUser(true)}
                className={cn(
                  "px-4 py-2 text-sm font-medium rounded-lg",
                  "bg-indigo-600 text-white hover:bg-indigo-700",
                  "shadow-sm hover:shadow",
                  "flex items-center gap-2 transition-all",
                  "disabled:opacity-50 disabled:cursor-not-allowed"
                )}
                disabled={currentUser?.role !== 'owner' && currentUser?.role !== 'admin'}
              >
                <UserPlus className="w-4 h-4" />
                Add Member
              </button>
            </div>
          </div>

          {error ? (
            <div className="rounded-lg bg-red-50 p-4">
              <div className="flex">
                <AlertCircle className="h-5 w-5 text-red-400" />
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">Error</h3>
                  <div className="mt-2 text-sm text-red-700">
                    <p>{error}</p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Member
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Role
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {members.map((member) => (
                    <tr key={member.user_id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center">
                            <User className="w-4 h-4 text-indigo-600" />
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">
                              {userService.formatUserName(member)}
                            </div>
                            <div className="text-sm text-gray-500">
                              {member.email}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <select
                          value={member.role}
                          onChange={(e) => handleRoleChange(member.user_id, e.target.value)}
                          disabled={
                            member.user_id === currentUser?.id ||
                            member.role === 'owner' ||
                            currentUser?.role !== 'owner'
                          }
                          className={cn(
                            "text-sm rounded-full px-3 py-1 font-medium",
                            member.role === 'owner'
                              ? "bg-purple-100 text-purple-700"
                              : member.role === 'admin'
                              ? "bg-indigo-100 text-indigo-700"
                              : "bg-gray-100 text-gray-700"
                          )}
                        >
                          <option value="owner" disabled={member.role !== 'owner'}>
                            Owner
                          </option>
                          <option value="admin">Admin</option>
                          <option value="member">Member</option>
                        </select>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        {member.user_id !== currentUser?.id && member.role !== 'owner' && (
                          <button
                            onClick={() => handleRemoveMember(member.user_id)}
                            disabled={isDeleting === member.user_id || member.role === 'owner'}
                            className={cn(
                              "text-red-600 hover:text-red-900",
                              "disabled:opacity-50 disabled:cursor-not-allowed"
                            )}
                          >
                            Remove
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Add User Modal */}
      {isAddingUser && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-[2px] flex items-center justify-center p-4 z-[60]">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center">
                  <UserPlus className="w-5 h-5 text-indigo-600" />
                </div>
                <h3 className="text-lg font-medium text-gray-900">Add New Member</h3>
              </div>
              <button
                onClick={() => setIsAddingUser(false)}
                className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddMember} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  required
                  value={newUser.email}
                  onChange={(e) => setNewUser(prev => ({ ...prev, email: e.target.value }))}
                  className={cn(
                    "w-full px-4 py-2 text-sm rounded-lg transition-all",
                    "border border-gray-200 focus:border-indigo-500",
                    "focus:ring-2 focus:ring-indigo-500/10",
                    "placeholder:text-gray-400"
                  )}
                  placeholder="member@example.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Password
                </label>
                <input
                  type="password"
                  required
                  value={newUser.password}
                  onChange={(e) => setNewUser(prev => ({ ...prev, password: e.target.value }))}
                  className={cn(
                    "w-full px-4 py-2 text-sm rounded-lg transition-all",
                    "border border-gray-200 focus:border-indigo-500",
                    "focus:ring-2 focus:ring-indigo-500/10",
                    "placeholder:text-gray-400"
                  )}
                  placeholder="••••••••"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    First Name
                  </label>
                  <input
                    type="text"
                    value={newUser.first_name}
                    onChange={(e) => setNewUser(prev => ({ ...prev, first_name: e.target.value }))}
                    className={cn(
                      "w-full px-4 py-2 text-sm rounded-lg transition-all",
                      "border border-gray-200 focus:border-indigo-500",
                      "focus:ring-2 focus:ring-indigo-500/10",
                      "placeholder:text-gray-400"
                    )}
                    placeholder="John"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Last Name
                  </label>
                  <input
                    type="text"
                    value={newUser.last_name}
                    onChange={(e) => setNewUser(prev => ({ ...prev, last_name: e.target.value }))}
                    className={cn(
                      "w-full px-4 py-2 text-sm rounded-lg transition-all",
                      "border border-gray-200 focus:border-indigo-500",
                      "focus:ring-2 focus:ring-indigo-500/10",
                      "placeholder:text-gray-400"
                    )}
                    placeholder="Doe"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Role
                </label>
                <select
                  value={newUser.role}
                  onChange={(e) => setNewUser(prev => ({ ...prev, role: e.target.value }))}
                  className={cn(
                    "w-full px-4 py-2 text-sm rounded-lg transition-all",
                    "border border-gray-200 focus:border-indigo-500",
                    "focus:ring-2 focus:ring-indigo-500/10",
                    "bg-white"
                  )}
                >
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setIsAddingUser(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={cn(
                    "px-4 py-2 text-sm font-medium rounded-lg",
                    "bg-indigo-600 text-white hover:bg-indigo-700",
                    "shadow-sm hover:shadow",
                    "flex items-center gap-2",
                    "disabled:opacity-50 disabled:cursor-not-allowed"
                  )}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Adding Member...
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-4 h-4" />
                      Add Member
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
