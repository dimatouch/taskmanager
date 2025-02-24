import { useState, useEffect, useRef } from 'react';
import { EyeIcon, Search, X, Loader2 } from 'lucide-react';
import { cn } from '../../../../lib/utils';
import { supabase } from '../../../../lib/supabase';
import { userService } from '../../../../services/userService';
import { taskActivityService } from '../../../../services/taskActivityService';
import type { Task } from '../types';

interface TaskViewersProps {
  task: Task;
  users: { id: string; email: string }[];
}

export function TaskViewers({ task, users }: TaskViewersProps) {
  const [isViewersDropdownVisible, setIsViewersDropdownVisible] = useState(false);
  const [viewers, setViewers] = useState<string[]>([]);
  const [savingViewer, setSavingViewer] = useState<string | null>(null);
  const [companyUsers, setCompanyUsers] = useState<{ id: string; email: string }[]>([]);
  const [isViewersButtonVisible, setIsViewersButtonVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const init = async () => {
      try {
        // Get current user's profile to get company
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('current_company_id')
          .eq('user_id', task.owner_id)
          .single();

        if (!profile?.current_company_id) return;

        // Get company members
        const { data: members } = await supabase
          .from('company_members')
          .select(`
            user_id,
            user:user_profiles!inner(
              email,
              first_name,
              last_name
            )
          `)
          .eq('company_id', profile.current_company_id);

        if (members) {
          const companyUsers = members.map(member => ({
            id: member.user_id,
            email: member.user.email,
            first_name: member.user.first_name || '',
            last_name: member.user.last_name || ''
          }));
          setCompanyUsers(companyUsers);
        }

        // Fetch viewers from task_roles
        const { data: viewersData } = await supabase
          .from('task_roles')
          .select('user_id')
          .eq('task_id', task.id)
          .eq('role', 'viewer');
        
        if (viewersData) {
          // By default add owner, responsible and co-workers to viewers list
          const defaultViewers = new Set([
            task.owner_id,
            task.responsible_id,
            ...(task.coworkers || [])
          ].filter(Boolean));
          
          viewersData.forEach(v => defaultViewers.add(v.user_id));
          setViewers(Array.from(defaultViewers));
          
          // Show button only for owner or responsible
          const { data: { user } } = await supabase.auth.getUser();
          setIsViewersButtonVisible(
            user.id === task.owner_id || 
            user.id === task.responsible_id
          );
        }
      } catch (err) {
        console.error('Failed to initialize viewers:', err);
      }
    };

    init();
  }, [task]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        isViewersDropdownVisible &&
        dropdownRef.current &&
        buttonRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setIsViewersDropdownVisible(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isViewersDropdownVisible]);

  const handleViewerChange = async (userId: string) => {
    // Don't allow removing owner, responsible, or co-workers
    if (
      userId === task.owner_id ||
      userId === task.responsible_id ||
      (task.coworkers && task.coworkers.includes(userId))
    ) {
      return;
    }

    if (savingViewer) return;
    setSavingViewer(userId);

    try {
      if (viewers.includes(userId)) {
        // Remove viewer role
        const { error: deleteError } = await supabase
          .from('task_roles')
          .delete()
          .eq('task_id', task.id)
          .eq('user_id', userId)
          .eq('role', 'viewer');

        if (deleteError) throw deleteError;
        
        setViewers(prev => prev.filter(id => id !== userId));
      } else {
        // Add viewer role
        const { error: insertError } = await supabase
          .from('task_roles')
          .insert({
            task_id: task.id,
            user_id: userId,
            role: 'viewer'
          });

        if (insertError) throw insertError;
        
        setViewers(prev => [...prev, userId]);
      }

      // Log activity
      await taskActivityService.logActivity({
        taskId: task.id,
        field: 'viewers',
        oldValue: viewers.join(','),
        newValue: viewers.includes(userId)
          ? viewers.filter(id => id !== userId).join(',')
          : [...viewers, userId].join(','),
        type: 'update'
      });

    } catch (err) {
      console.error('Failed to update viewers:', err);
    } finally {
      setSavingViewer(null);
    }
  };

  if (!isViewersButtonVisible) return null;

  return (
    <>
      <button
        type="button"
        ref={buttonRef}
        onClick={() => setIsViewersDropdownVisible(!isViewersDropdownVisible)}
        className="absolute top-4 left-4 p-2 rounded-full bg-gray-50/80 hover:bg-gray-100/80 text-gray-400 hover:text-gray-600 transition-colors"
      >
        <EyeIcon className="w-4 h-4" />
      </button>

      {isViewersDropdownVisible && (
        <div 
          ref={dropdownRef}
          className="absolute top-14 left-4 w-80 bg-white rounded-lg shadow-lg border border-gray-200 z-50"
        >
          <div className="px-4 py-3 border-b">
            <h3 className="text-sm font-medium text-gray-700">Who can view this task</h3>
            <div className="mt-2 relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search users..."
                className={cn(
                  "w-full px-8 py-1.5 text-sm rounded-md",
                  "bg-gray-50 border border-gray-200",
                  "focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500"
                )}
              />
              <Search className="w-4 h-4 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-gray-200 text-gray-400"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
          <div className="max-h-[320px] overflow-y-auto py-2">
            {companyUsers
              .filter(user => 
                user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (user.first_name && user.first_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
                (user.last_name && user.last_name.toLowerCase().includes(searchQuery.toLowerCase()))
              )
              .map(user => {
              const isDefaultViewer =
                user.id === task.owner_id ||
                user.id === task.responsible_id ||
                (task.coworkers && task.coworkers.includes(user.id));

              const userRole = 
                user.id === task.owner_id
                  ? 'Owner'
                  : user.id === task.responsible_id
                  ? 'Responsible'
                  : task.coworkers?.includes(user.id)
                  ? 'Co-worker'
                  : null;

              return (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => !isDefaultViewer && handleViewerChange(user.id)}
                  className={cn(
                    "w-full px-4 py-2.5 text-sm text-left transition-colors",
                    "hover:bg-gray-50 flex items-center justify-between gap-3",
                    isDefaultViewer && "bg-gray-50/50",
                    viewers.includes(user.id) && !isDefaultViewer && "bg-gray-50"
                  )}
                  disabled={isDefaultViewer || savingViewer !== null}
                >
                  <div className="flex items-center flex-1">
                    <div className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium",
                      isDefaultViewer 
                        ? "bg-indigo-100 text-indigo-700"
                        : viewers.includes(user.id)
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-gray-100 text-gray-700"
                    )}>
                      {userService.formatUserName(user).charAt(0).toUpperCase()}
                    </div>
                    <div className="ml-3 flex flex-col min-w-0">
                      <span className="text-sm font-medium text-gray-900 truncate">
                        {userService.formatUserName(user)}
                      </span>
                      {userRole && (
                        <span className="text-xs text-gray-500">
                          {userRole}
                        </span>
                      )}
                    </div>
                  </div>
                  {isDefaultViewer ? (
                    <span className={cn(
                      "px-2 py-1 rounded-full text-xs font-medium",
                      user.id === task.owner_id
                        ? "bg-blue-100 text-blue-700"
                        : user.id === task.responsible_id
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-indigo-100 text-indigo-700"
                    )}>
                      {userRole}
                    </span>
                  ) : (
                    <div className={cn(
                      "w-5 h-5 rounded-md border-2 transition-colors",
                      viewers.includes(user.id)
                        ? "bg-emerald-500 border-emerald-500"
                        : "border-gray-300"
                    )}>
                      {savingViewer === user.id ? (
                        <Loader2 className="w-4 h-4 animate-spin text-white" />
                      ) : viewers.includes(user.id) && (
                        <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}