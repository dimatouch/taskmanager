import { useState, useEffect, useCallback } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { create } from 'zustand';
import { 
  CheckSquare, 
  LogOut,
  Calendar,
  FileCode,
  LayoutDashboard,
  Video,
  Folder,
  Lightbulb,
  Plus,
  FolderKanban,
  ChevronRight,
  ChevronDown,
  User,
  Clock,
  Star,
  Users,
  X,
  Settings,
  Shield,
  Building,
  UserCircle,
  Loader2
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { cn } from '../../lib/utils';
import { createRoot } from 'react-dom/client';
import { CreateProject } from '../projects/CreateProject';
import { LanguageSwitcher } from './LanguageSwitcher';
import { useTranslation } from '../../lib/i18n/useTranslation';
import { useCompany } from '../../contexts/CompanyContext';

interface SidebarStore {
  isOpen: boolean;
  toggle: () => void;
}

export const useSidebarStore = create<SidebarStore>((set) => ({
  isOpen: true,
  toggle: () => set((state) => ({ isOpen: !state.isOpen })),
}));

export function Sidebar() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const location = useLocation();
  const { currentCompany } = useCompany();
  const [isTasksOpen, setIsTasksOpen] = useState(true);
  const [isProjectsOpen, setIsProjectsOpen] = useState(false);
  const [isCompanyOpen, setIsCompanyOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<{ 
    email: string;
    companyRole?: string;
  } | null>(null);
  const [isResetting, setIsResetting] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const isOpen = useSidebarStore((state) => state.isOpen);
  const toggle = useSidebarStore((state) => state.toggle);

  // Get the base URL for redirects
  const getBaseUrl = () => {
    return window.location.origin;
  };

  const handleResetPassword = async () => {
    try {
      setIsResetting(true);
      setResetError(null);
      setResetSuccess(false);

      if (!currentUser?.email) {
        throw new Error('No email address found');
      }

      const redirectTo = `${getBaseUrl()}/auth/update-password`;
      console.log('Reset password redirect URL:', redirectTo);

      const { error } = await supabase.auth.resetPasswordForEmail(
        currentUser.email,
        { redirectTo }
      );

      if (error) throw error;

      setResetSuccess(true);
    } catch (err) {
      console.error('Failed to reset password:', err);
      setResetError(err instanceof Error ? err.message : 'Failed to reset password');
    } finally {
      setIsResetting(false);
    }
  };

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user && currentCompany?.id) {
        // Get user's role in current company
        const { data: member } = await supabase
          .from('company_members')
          .select('role')
          .eq('user_id', user.id)
          .eq('company_id', currentCompany?.id)
          .single();

        setCurrentUser({ 
          email: user.email || '',
          companyRole: member?.role
        });

        // Fetch projects for current company
        const { data: projects } = await supabase
          .from('projects')
          .select('id, name')
          .eq('company_id', currentCompany.id)
          .order('name');
        
        setProjects(projects || []);
      } else if (user) {
        // Just set email if no company context yet
        setCurrentUser({
          email: user.email || ''
        });
      }
    };
    init();
  }, [currentCompany]);

  const handleSignOut = useCallback(async () => { 
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  }, []);

  // Close sections when sidebar is closed
  useEffect(() => {
    if (!isOpen) {
      setIsTasksOpen(false);
    }
  }, [isOpen]);

  return (
    <div 
      className={cn(
        "fixed left-0 top-0 h-screen bg-white border-r transition-all duration-300 ease-in-out z-50 shadow-xl",
        isOpen ? "w-64 translate-x-0" : "-translate-x-full w-64"
      )}
    >
      <div className="flex flex-col h-full">
        <div className="p-6 border-b">
          {currentCompany && (
            <h1 className="text-xl font-bold text-gray-900">{currentCompany.name}</h1>
          )}
          <div className="mt-2">
            <LanguageSwitcher />
          </div>
        </div>
        <button
          onClick={toggle}
          className={cn(
            "absolute -right-4 top-8 w-8 h-8 bg-indigo-50 rounded-full shadow-lg flex items-center justify-center",
            "border-2 border-primary-200 text-primary-500 hover:text-primary-600 hover:bg-primary-100 transition-all duration-200",
            "focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2",
            "hover:scale-110 transform"
          )}
        >
          {isOpen ? <X className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>

        <div className="flex-1 overflow-y-auto">
          <nav className="p-6 space-y-8">
            <div>
              <NavLink
                to={currentCompany ? `/${currentCompany.id}` : '#'}
                onClick={(e) => !currentCompany && e.preventDefault()}
                className={({ isActive }) => cn(
                  "flex items-center justify-between w-full text-sm font-medium text-gray-600 hover:text-gray-900 mb-2",
                  isActive && "text-primary-500"
                )}
              >
                <span className="flex items-center">
                  <LayoutDashboard className="w-4 h-4 mr-2" />
                  {t('sidebar.dashboard')}
                </span>
              </NavLink>
              <NavLink
                to={currentCompany ? `/${currentCompany.id}/ideas` : '#'}
                onClick={(e) => !currentCompany && e.preventDefault()}
                className={({ isActive }) => cn(
                  "flex items-center justify-between w-full text-sm font-medium text-gray-600 hover:text-gray-900 mb-2",
                  isActive && "text-primary-500"
                )}
              >
                <span className="flex items-center">
                  <Lightbulb className="w-4 h-4 mr-2" />
                  {t('sidebar.ideas')}
                </span>
              </NavLink>

              <NavLink
                to={currentCompany ? `/${currentCompany.id}/tasks` : '#'}
                onClick={(e) => !currentCompany && e.preventDefault()}
                className={({ isActive }) => cn(
                  "flex items-center justify-between w-full text-sm font-medium text-gray-600 hover:text-gray-900 mb-2",
                  isActive && "text-primary-500"
                )}
              >
                <span className="flex items-center">
                  <CheckSquare className="w-4 h-4 mr-2" />
                  {t('sidebar.tasks')}
                </span>
              </NavLink>
            </div>

            <div>
              <button
                onClick={() => setIsProjectsOpen(!isProjectsOpen)}
                className="flex items-center justify-between w-full text-sm font-medium text-gray-600 hover:text-gray-900 mb-2"
              >
                <span className="flex items-center">
                  <FolderKanban className="w-4 h-4 mr-2" />
                  {t('sidebar.projects')}
                </span>
                <ChevronDown className={cn(
                  "w-4 h-4 transition-transform duration-200",
                  !isProjectsOpen && "-rotate-90"
                )} />
              </button>

              <div className={cn(
                "space-y-1 overflow-hidden transition-all duration-200",
                isProjectsOpen ? "max-h-96" : "max-h-0"
              )}>
                {projects.map(project => (
                  <NavLink
                    key={project.id}
                    to={currentCompany ? `/${currentCompany.id}/projects/${project.id}` : '#'}
                    onClick={(e) => !currentCompany && e.preventDefault()}
                    className={({ isActive }) => 
                      cn(
                        "flex items-center text-sm py-1.5 px-2 rounded-lg transition-colors ml-4",
                        isActive
                          ? "bg-primary-50 text-primary-500 font-medium"
                          : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                      )
                    }
                  >
                    <Folder className="w-4 h-4 mr-1.5 flex-shrink-0 text-gray-400" />
                    <span className="truncate">{project.name}</span>
                  </NavLink>
                ))}
                 
                <button
                  onClick={() => {
                    const modal = document.createElement('div');
                    modal.id = 'project-create-modal';
                    document.body.appendChild(modal);
                    
                    const root = createRoot(modal);
                    root.render(
                      <div className="fixed inset-0 bg-black/30 backdrop-blur-[2px] flex items-start justify-center p-4 z-[60] animate-in fade-in duration-200">
                        <div className="w-full max-w-md">
                          <CreateProject
                            onSuccess={(project) => {
                              setProjects(prev => [...prev, project]);
                              root.unmount();
                              document.body.removeChild(modal);
                            }}
                            onCancel={() => {
                              root.unmount();
                              document.body.removeChild(modal);
                            }}
                          />
                        </div>
                      </div>
                    );
                  }}
                  className={cn(
                    "flex items-center text-sm py-1.5 px-2 rounded-lg transition-colors ml-4",
                    "text-gray-400 hover:text-gray-600 hover:bg-gray-50"
                  )}
                >
                  <Plus className="w-4 h-4 mr-1.5 flex-shrink-0" />
                  {t('projects.addProject')}
                </button>
              </div>
            </div>
          </nav>
        </div>
        
        {/* Admin Section - Only visible to company owners and admins */}
        {currentCompany && currentUser && (
          <div className="p-4 border-t">
            {/* Only show admin section for company owners and admins */}
            {currentUser.companyRole && ['owner', 'admin'].includes(currentUser.companyRole) && (
              <>
                <div className="mb-2">
                  <span className="px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    Admin
                  </span>
                </div>
                <NavLink
                  to={`/${currentCompany.id}/admin/settings`}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-colors",
                      isActive
                        ? "bg-primary-50 text-primary-500"
                        : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                    )
                  }
                >
                  <Building className="w-4 h-4 mr-2" />
                  Company Settings
                </NavLink>
                
                <NavLink
                  to={`/${currentCompany.id}/admin/calendar`}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-colors",
                      isActive
                        ? "bg-primary-50 text-primary-500"
                        : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                    )
                  }
                >
                  <Calendar className="w-4 h-4 mr-2" />
                  Calendar Settings
                </NavLink>
                
                <NavLink
                  to={`/${currentCompany.id}/admin/recordings`}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-colors",
                      isActive
                        ? "bg-primary-50 text-primary-500"
                        : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                    )
                  }
                >
                  <Video className="w-4 h-4 mr-2" />
                  Screen Recordings
                </NavLink>
              </>
            )}
          </div>
        )}
        <div className="p-4 border-t space-y-2">
          {currentUser && (
            <div className="px-4 py-2 text-sm text-gray-600">
              <div className="flex flex-col space-y-2">
                <span>{t('auth.signedInAs')}:</span>
                <div className="font-medium text-gray-900 truncate">
                  {currentUser.email}
                </div>
                <div className="relative mt-2">
                  <button
                    onClick={() => setShowResetConfirm(true)}
                    disabled={isResetting}
                    className={cn(
                      "text-xs text-indigo-600 hover:text-indigo-700 text-left",
                      "flex items-center gap-1",
                      "disabled:opacity-50 disabled:cursor-not-allowed"
                    )}
                  >
                    {isResetting ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <svg 
                        className="w-3 h-3"
                        viewBox="0 0 24 24" 
                        fill="none" 
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="M12 15V17M6 21H18C19.1046 21 20 20.1046 20 19V13C20 11.8954 19.1046 11 18 11H6C4.89543 11 4 11.8954 4 13V19C4 20.1046 4.89543 21 6 21ZM16 11V7C16 4.79086 14.2091 3 12 3C9.79086 3 8 4.79086 8 7V11H16Z" />
                      </svg>
                    )}
                    <span className="ml-1">Reset Password</span>
                  </button>
                  {resetSuccess && (
                    <div className="absolute top-full left-0 mt-1 text-xs text-emerald-600 bg-emerald-50 px-2 py-1 rounded">
                      Check your email for reset instructions
                    </div>
                  )}
                  {resetError && (
                    <div className="absolute top-full left-0 mt-1 text-xs text-red-600 bg-red-50 px-2 py-1 rounded">
                      {resetError}
                    </div>
                  )}
                </div>
                {/* Reset Password Confirmation Modal */}
                {showResetConfirm && (
                  <div className="fixed inset-0 bg-black/30 backdrop-blur-[2px] flex items-center justify-center p-4 z-[100]">
                    <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center">
                          <svg 
                            className="w-5 h-5 text-indigo-600"
                            viewBox="0 0 24 24" 
                            fill="none" 
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <path d="M12 15V17M6 21H18C19.1046 21 20 20.1046 20 19V13C20 11.8954 19.1046 11 18 11H6C4.89543 11 4 11.8954 4 13V19C4 20.1046 4.89543 21 6 21ZM16 11V7C16 4.79086 14.2091 3 12 3C9.79086 3 8 4.79086 8 7V11H16Z" />
                          </svg>
                        </div>
                        <div>
                          <h3 className="text-lg font-medium text-gray-900">Reset Password</h3>
                          <p className="text-sm text-gray-500">Are you sure you want to reset your password?</p>
                        </div>
                      </div>
                      <p className="text-sm text-gray-600 mb-6">
                        A password reset link will be sent to your email address. The link will expire in 24 hours.
                      </p>
                      <div className="flex justify-end gap-3">
                        <button
                          onClick={() => setShowResetConfirm(false)}
                          className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => {
                            setShowResetConfirm(false);
                            handleResetPassword();
                          }}
                          disabled={isResetting}
                          className={cn(
                            "px-4 py-2 text-sm font-medium rounded-lg",
                            "bg-indigo-600 text-white hover:bg-indigo-700",
                            "disabled:opacity-50 disabled:cursor-not-allowed",
                            "flex items-center gap-2"
                          )}
                        >
                          {isResetting ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Sending...
                            </>
                          ) : (
                            'Send Reset Link'
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
          <button
            onClick={handleSignOut}
            className={cn(
              "flex items-center w-full px-4 py-2 text-sm font-medium rounded-lg transition-colors",
              "text-red-600 hover:text-red-700 hover:bg-red-50"
            )}
          >
            <LogOut className="w-4 h-4 mr-2" />
            {t('auth.signOut')}
          </button>
        </div>

        {isOpen && (
          <div 
            className="lg:hidden fixed inset-0 bg-black/30 backdrop-blur-sm z-40 transition-opacity duration-300"
            onClick={toggle}
          />
        )}
      </div>
    </div>
  );
}