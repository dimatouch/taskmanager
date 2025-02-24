import { useState } from 'react';
import { Plus, FolderPlus } from 'lucide-react';
import { CreateProject } from './CreateProject';
import { Project } from '../../types/supabase';
import { cn } from '../../lib/utils';

interface ProjectCreateButtonProps {
  onProjectCreated: (project: Project) => void;
  className?: string;
}

export function ProjectCreateButton({ onProjectCreated, className }: ProjectCreateButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={cn(
          "inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200",
          "bg-gradient-to-r from-indigo-50 to-purple-50 text-indigo-600",
          "border border-indigo-200 shadow-sm",
          "hover:from-indigo-100 hover:to-purple-100 hover:border-indigo-300 hover:shadow",
          className
        )}
      >
        <FolderPlus className="w-4 h-4 mr-2" />
        Add Project
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-[2px] flex items-start justify-center p-4 z-[60] animate-in fade-in duration-200">
          <div className="w-full max-w-md">
            <CreateProject
              onSuccess={(project) => {
                onProjectCreated(project);
                setIsOpen(false);
              }}
              onCancel={() => setIsOpen(false)}
            />
          </div>
        </div>
      )}
    </>
  );
}