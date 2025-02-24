import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, AlertCircle, Pencil, Check, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { cn } from '../lib/utils';
import { Dashboard } from '../components/dashboard/Dashboard';

interface Project {
  id: string;
  name: string;
  description: string | null;
  owner_id: string;
  created_at: string;
  updated_at: string;
}

export function ProjectPage() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [editedDescription, setEditedDescription] = useState<string | null>('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    async function fetchProject() {
      if (!projectId) return;

      try {
        setIsLoading(true);
        setError(null);

        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          setError('Please sign in to view projects');
          return;
        }

        const { data: project, error } = await supabase
          .from('projects')
          .select('*')
          .eq('id', projectId)
          .single();

        if (error) throw error;
        if (!project) throw new Error('Project not found');

        setProject(project);
        setEditedName(project.name);
        setEditedDescription(project.description);
      } catch (err) {
        console.error('Failed to fetch project:', err);
        setError(err instanceof Error ? err.message : 'Failed to load project');
      } finally {
        setIsLoading(false);
      }
    }

    fetchProject();
  }, [projectId]);

  const handleSave = async () => {
    if (!project || !editedName.trim()) return;
    
    try {
      setIsSaving(true);
      
      const { error } = await supabase
        .from('projects')
        .update({
          name: editedName.trim(),
          description: editedDescription?.trim() || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', project.id);

      if (error) throw error;

      setProject(prev => prev ? {
        ...prev,
        name: editedName.trim(),
        description: editedDescription?.trim() || null,
        updated_at: new Date().toISOString()
      } : null);
      
      setIsEditing(false);
    } catch (err) {
      console.error('Failed to update project:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    if (!project) return;
    setEditedName(project.name);
    setEditedDescription(project.description);
    setIsEditing(false);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <button
          onClick={() => navigate('/projects')}
          className="mb-6 inline-flex items-center px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 bg-white rounded-lg shadow-sm hover:shadow transition-all"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to Projects
        </button>
        <div className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full">
          <div className="flex items-center justify-center w-12 h-12 mx-auto mb-4 rounded-full bg-red-100">
            <AlertCircle className="w-6 h-6 text-red-600" />
          </div>
          <h3 className="text-lg font-medium text-center text-gray-900 mb-2">
            Error Loading Project
          </h3>
          <p className="text-sm text-center text-gray-600 mb-6">
            {error || 'Project not found'}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="w-full px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto">
        <div>
          {/* Navigation */}
          <div className="flex items-center justify-between mb-6 px-4 sm:px-6 lg:px-8">
            <button
              onClick={() => navigate('/projects')}
              className={cn(
                "inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-lg transition-all",
                "text-gray-600 hover:text-gray-900 bg-white/50 hover:bg-white",
                "shadow-sm hover:shadow border border-gray-200/50"
              )}
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back to Projects
            </button>

            {!isEditing ? (
              <button
                onClick={() => setIsEditing(true)}
                className={cn(
                  "inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-lg transition-all",
                  "text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100",
                  "shadow-sm hover:shadow border border-indigo-200/50"
                )}
              >
                <Pencil className="w-4 h-4 mr-1" />
                Edit Project
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleSave}
                  disabled={isSaving || !editedName.trim()}
                  className={cn(
                    "inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-lg transition-all",
                    "text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100",
                    "shadow-sm hover:shadow border border-emerald-200/50",
                    "disabled:opacity-50 disabled:cursor-not-allowed"
                  )}
                >
                  <Check className="w-4 h-4 mr-1" />
                  Save
                </button>
                <button
                  onClick={handleCancel}
                  className={cn(
                    "inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-lg transition-all",
                    "text-gray-600 hover:text-gray-700 bg-gray-50 hover:bg-gray-100",
                    "shadow-sm hover:shadow border border-gray-200/50"
                  )}
                >
                  <X className="w-4 h-4 mr-1" />
                  Cancel
                </button>
              </div>
            )}
          </div>

          {/* Project Title & Description */}
          <div className="bg-white rounded-xl shadow-lg border overflow-hidden mb-8 mx-4 sm:mx-6 lg:mx-8">
            {isEditing ? (
              <div className="p-6 space-y-4">
                <div>
                  <input
                    type="text"
                    value={editedName}
                    onChange={(e) => setEditedName(e.target.value)}
                    className={cn(
                      "w-full text-2xl font-bold bg-transparent border-0",
                      "focus:ring-2 focus:ring-indigo-500/10 rounded-lg px-2 -mx-2",
                      "bg-gray-50/50 hover:bg-gray-50"
                    )}
                    placeholder="Project name"
                  />
                </div>
                <div>
                  <textarea
                    value={editedDescription || ''}
                    onChange={(e) => setEditedDescription(e.target.value)}
                    className={cn(
                      "w-full text-gray-600 bg-transparent border-0 resize-none",
                      "focus:ring-2 focus:ring-indigo-500/10 rounded-lg px-2 -mx-2",
                      "bg-gray-50/50 hover:bg-gray-50"
                    )}
                    placeholder="Add project description..."
                    rows={3}
                  />
                </div>
              </div>
            ) : (
              <div className="p-6">
                <h1 className="text-2xl font-bold text-gray-900 mb-2">
                  {project.name}
                </h1>
                {project.description && (
                  <p className="text-gray-600">{project.description}</p>
                )}
              </div>
            )}
          </div>

          <div className="-mx-4 sm:-mx-6 lg:-mx-8">
            <Dashboard projectId={project.id} />
          </div>
        </div>
      </div>
    </div>
  );
}