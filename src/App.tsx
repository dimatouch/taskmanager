import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { cn } from './lib/utils';
import { AuthForm } from './components/auth/AuthForm';
import { Sidebar, useSidebarStore } from './components/layout/Sidebar';
import { Dashboard } from './components/dashboard/Dashboard';
import { ScreenRecordingsPage } from './pages/ScreenRecordingsPage';
import { CompanyAdminPage } from './pages/CompanyAdminPage';
import { TaskPage } from './pages/TaskPage';
import { GoogleCalendarIntegration } from './components/calendar/GoogleCalendarIntegration';
import { DashboardPage } from './pages/DashboardPage';
import { UpdatePasswordPage } from './pages/UpdatePasswordPage';
import { IdeasPage } from './pages/IdeasPage';
import UserProfilePage from './pages/UserProfilePage';
import { ProjectPage } from './pages/ProjectPage';
import { TaskStatusesPage } from './pages/TaskStatusesPage';
import { supabase } from './lib/supabase';
import { CompanyProvider } from './contexts/CompanyContext';
import { CompanyRedirect } from './components/companies/CompanyRedirect';
import { GoogleCalendarCallback } from './components/calendar/GoogleCalendarCallback';

interface CompanyRoutesProps {
  user: any;
}

function CompanyRoutes({ user }: CompanyRoutesProps) {
  const isOpen = useSidebarStore((state) => state.isOpen);

  return (
    <CompanyProvider>
      <div className={cn(
        "transition-all duration-300 ease-in-out",
        isOpen ? "ml-64" : "ml-0"
      )}>
        <Sidebar />
        <Routes>
          <Route index element={<DashboardPage />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="ideas" element={<IdeasPage />} />
          
          {/* Tasks Routes */}
          <Route path="tasks">
            <Route index element={<Dashboard />} />
            <Route path="my" element={<Dashboard filter="my" />} />
            <Route path="created" element={<Dashboard filter="created" />} />
            <Route path=":taskId" element={<TaskPage />} />
          </Route>
          
          {/* Projects Route */}
          <Route path="projects/:projectId" element={<ProjectPage />} />
          
          {/* Settings Routes */}
          <Route path="settings">
            <Route index element={<CompanyAdminPage />} />
            <Route path="members" element={<CompanyAdminPage activeTab="members" />} />
            <Route path="requests" element={<CompanyAdminPage activeTab="requests" />} />
            <Route path="statuses" element={<TaskStatusesPage />} />
          </Route>
          
          <Route path="profile" element={<UserProfilePage />} />
          <Route path="users/:userId" element={<UserProfilePage />} />
          <Route path="calendar-callback" element={<GoogleCalendarCallback />} />
          
          <Route path="admin">
            <Route path="settings" element={<CompanyAdminPage />} />
            <Route path="calendar" element={<GoogleCalendarIntegration />} />
            <Route path="recordings" element={<ScreenRecordingsPage />} />
          </Route>
        </Routes>
      </div>
    </CompanyProvider>
  );
}

function App() {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function initAuth() {
      try {
        setIsLoading(true);
        const { data: { session } } = await supabase.auth.getSession();
        setUser(session?.user ?? null);
        
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
          setUser(session?.user ?? null);
        });
        return () => subscription.unsubscribe();
      } catch (err) {
        console.error('Auth error:', err);
      } finally {
        setIsLoading(false);
      }
    }
    initAuth();
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {user ? (
        <Router>
          <Routes>
            <Route path="/" element={<CompanyRedirect />} />
            {/* Auth Routes */}
            <Route path="/auth/*">
              <Route path="update-password" element={<UpdatePasswordPage />} />
            </Route>
            <Route path="/auth/update-password" element={<UpdatePasswordPage />} />
            
            {/* Company Routes */}
            <Route path="/:companyId/*" element={<CompanyRoutes user={user} />} />
          </Routes>
        </Router>
      ) : (
        <div className="min-h-screen flex items-center justify-center">
          <AuthForm />
        </div>
      )}
    </div>
  );
}

export default App;