import { Editor, useEditor, EditorContent } from '@tiptap/react';
import { useState, useEffect, useRef } from 'react';
import { Plus, Paperclip, Loader2, X, File, FileText, Image, AlertCircle, CheckCircle2, ClipboardList, Pencil, Trash2, ChevronRight } from 'lucide-react';
import { supabase } from '../../../../lib/supabase';
import { cn } from '../../../../lib/utils';
import { useCompany } from '../../../../contexts/CompanyContext';
import { ActivityList } from '../../ActivityList';
import { SubtaskList } from '../SubtaskList';
import { useNavigate } from 'react-router-dom';
import type { Task } from '../types';
import { TaskResultDisplay } from './TaskResultDisplay';
import { useTranslation } from '../../../../lib/i18n/useTranslation';
import { QuickTaskModal } from '../../QuickTaskModal';
import { RichTextToolbar } from './RichTextToolbar';
import { sanitizeFilename } from '../../../../lib/utils';
import StarterKit from '@tiptap/starter-kit';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { taskActivityService } from '../../../../services/taskActivityService';
import { v4 as uuidv4 } from 'uuid';
import { FileViewer } from './FileViewer';

interface TaskContentProps {
  editor: Editor | null;
  task: Task;
  statuses: any[];
  users: { id: string; email: string }[];
  isQuickTaskOpen: boolean;
  setIsQuickTaskOpen: (open: boolean) => void;
  onSubtaskCreated?: () => void;
}

// Додаємо інтерфейс для Modal
interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

// Додаємо компонент Modal
export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, children }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div 
        className="fixed inset-0 bg-black/50" 
        onClick={onClose}
      />
      <div className="relative z-50 bg-white rounded-lg max-w-4xl w-full mx-4">
        {children}
      </div>
    </div>
  );
};

interface FileWithStatus {
  id?: string;
  path?: string;
  url?: string;
  name: string;
  size: number;
  type: string;
  status?: 'uploading' | 'success' | 'error';
}

const styles = `
  @keyframes loading {
    0% { transform: translateX(-100%); }
    50% { transform: translateX(100%); }
    100% { transform: translateX(-100%); }
  }
`;

const FilePreview = ({ file, onRemove, index, onPreview }: { 
  file: FileWithStatus; 
  onRemove: (index: number) => void;
  index: number;
  onPreview: (file: FileWithStatus) => void;
}) => (
  <div 
    className={cn(
      "inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all duration-200",
      "border shadow-sm hover:shadow-md cursor-pointer",
      file.status === 'uploading' && "bg-blue-50",
      file.status === 'success' && "bg-white hover:bg-gray-50",
      file.status === 'error' && "bg-red-50",
      !file.status && "bg-gray-50",
      "group"
    )}
    onClick={() => file.status === 'success' && onPreview(file)}
  >
    <div className="flex items-center gap-2">
      {file.status === 'uploading' ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500" />
      ) : file.type?.startsWith('image/') ? (
        <Image className="w-4 h-4 text-indigo-500" />
      ) : file.type?.includes('pdf') ? (
        <FileText className="w-4 h-4 text-indigo-500" />
      ) : (
        <File className="w-4 h-4 text-indigo-500" />
      )}
      <span className="truncate max-w-[180px]">{file.name}</span>
    </div>
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onRemove(index);
      }}
      className={cn(
        "p-1.5 rounded-lg transition-all duration-200",
        "opacity-0 group-hover:opacity-100",
        "text-gray-400 hover:text-red-500 hover:bg-red-50"
      )}
    >
      <Trash2 className="w-3.5 h-3.5" />
    </button>
  </div>
);

const UploadingAnimation = () => (
  <div className="relative w-full h-1 bg-gray-100 overflow-hidden rounded-full">
    <div className="absolute inset-0 bg-indigo-500/20"></div>
    <div 
      className="absolute inset-y-0 bg-indigo-500 w-1/3 rounded-full animate-[loading_1s_ease-in-out_infinite]"
      style={{
        animation: 'loading 1s ease-in-out infinite',
      }}
    />
  </div>
);

export function TaskContent({ editor, task, statuses, users, onSubtaskCreated, isQuickTaskOpen, setIsQuickTaskOpen }: TaskContentProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { currentCompany } = useCompany();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<FileWithStatus[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewFile, setPreviewFile] = useState<FileWithStatus | null>(null);
  const [showFiles, setShowFiles] = useState(false);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [selectedFile, setSelectedFile] = useState<FileWithStatus | null>(null);

  // Helper function to generate unique file ID
  const generateId = () => uuidv4();

  const handleDeleteAttachment = async (index: number) => {
    try {
      setError(null);
      const fileToDelete = files[index];
      
      if (!fileToDelete) {
        throw new Error('File not found');
      }

      // Отримуємо поточні файли завдання
      const { data: currentTask } = await supabase
        .from('tasks')
        .select('files')
        .eq('id', task.id)
        .single();

      if (!currentTask) throw new Error('Task not found');

      // Видаляємо файл зі сховища
      if (fileToDelete.path) {
        const { error: storageError } = await supabase.storage
          .from('task-attachments')
          .remove([fileToDelete.path]);

        if (storageError) throw storageError;
      }

      // Оновлюємо масив файлів
      const newFiles = currentTask.files.filter((f: any) => f.path !== fileToDelete.path);
      
      // Оновлюємо завдання
      const { error: updateError } = await supabase
        .from('tasks')
        .update({ files: newFiles })
        .eq('id', task.id);

      if (updateError) throw updateError;

      // Оновлюємо локальний стан
      setFiles(prev => prev.filter((_, i) => i !== index));

      // Логуємо активність
      await taskActivityService.logActivity({
        taskId: task.id,
        type: 'attachment',
        field: 'files',
        oldValue: JSON.stringify(fileToDelete),
        type: 'delete'
      });

    } catch (err) {
      console.error('Failed to delete attachment:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete attachment');
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length === 0) return;
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }

    setIsUploading(true);
    setUploadProgress(0);
    setUploadStatus('uploading');

    try {
      console.log('Starting file upload...', selectedFiles);
      
      const uploadPromises = selectedFiles.map(async (file) => {
        // Generate unique ID for file
        const fileId = generateId(); 

        // Get file extension and create path
        const fileExt = file.name.split('.').pop();
        const sanitizedTaskId = task.id.replace(/[^a-zA-Z0-9]/g, '');
        const filePath = `${sanitizedTaskId}/${fileId}.${fileExt}`;
        
        console.log('Preparing file upload:', { fileId, filePath });

        // Create file object
        const newFile = {
          id: fileId,
          name: file.name,
          size: file.size,
          type: file.type,
          status: 'uploading' as const
        };

        // Add to local state
        setFiles(prev => [...prev, { ...newFile }]);

        try {
          // Завантажуємо файл
          const { error: uploadError, data } = await supabase.storage
            .from('task-attachments')
            .upload(filePath, file, {
              cacheControl: '3600',
              upsert: true
            });

          if (uploadError) {
            console.error('Upload error:', uploadError);
            throw uploadError;
          }

          console.log('File uploaded successfully:', data);

          // Отримуємо публічне URL
          const { data: { publicUrl } } = supabase.storage
            .from('task-attachments')
            .getPublicUrl(filePath);

          console.log('Got public URL:', publicUrl);

          return {
            ...newFile,
            path: filePath,
            url: publicUrl,
            status: 'success' as const
          };
        } catch (error) {
          console.error('Error in file upload:', error);
          throw error;
        }
      });

      const uploadedFiles = await Promise.all(uploadPromises);
      console.log('All files uploaded:', uploadedFiles);

      // Оновлюємо список файлів в базі даних
      const { error: updateError } = await supabase
        .from('tasks')
        .update({
          files: [...(task.files || []), ...uploadedFiles.map(f => ({
            id: f.id,
            name: f.name,
            path: f.path,
            url: f.url,
            size: f.size,
            type: f.type
          }))]
        })
        .eq('id', task.id);

      if (updateError) {
        console.error('Error updating task:', updateError);
        throw updateError;
      }

      setFiles(prev => {
        const newFiles = [...prev];
        uploadedFiles.forEach(uploadedFile => {
          const index = newFiles.findIndex(f => f.id === uploadedFile.id);
          if (index !== -1) {
            newFiles[index] = uploadedFile;
          }
        });
        return newFiles;
      });

      setUploadStatus('success');
      console.log('Upload completed successfully');

    } catch (error) {
      console.error('File upload error:', error);
      setError(error instanceof Error ? error.message : 'Failed to upload files');
      setUploadStatus('error');
      setFiles(prev => 
        prev.map(f => ({
          ...f,
          status: 'error' as const
        }))
      );
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handlePreview = (file: FileWithStatus) => {
    setPreviewFile(file);
    setIsPreviewOpen(true);
  };

  useEffect(() => {
    // Initialize files from task
    if (task.files) {
      setFiles(task.files.map(file => ({
        ...file,
        status: 'success'
      })));
    }
  }, [task.files]);

  useEffect(() => {
    if (editor) {
      editor.setEditable(isEditing);
      
      if (isEditing) {
        editor.commands.focus();
        editor.commands.setTextSelection(editor.state.doc.content.size);
      }

      // Додаємо обробник клавіші Enter
      const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'Enter' && !event.shiftKey) {
          event.preventDefault();
          setIsEditing(false);
          
          // Тут можна додати збереження змін, якщо потрібно
          // Наприклад:
          // handleSaveChanges();
        }
      };

      if (isEditing) {
        // Додаємо слухач події
        editor.view.dom.addEventListener('keydown', handleKeyDown);
      }

      // Прибираємо слухач при розмонтуванні
      return () => {
        if (editor?.view?.dom) {
          editor.view.dom.removeEventListener('keydown', handleKeyDown);
        }
      };
    }
  }, [isEditing, editor]);

  // Ефект для автоматичного приховування повідомлення
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (uploadStatus === 'success') {
      setShowSuccessMessage(true);
      timer = setTimeout(() => {
        setShowSuccessMessage(false);
      }, 3000);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [uploadStatus]);

  const shouldExpandList = files.length > 4;

  // Функція для перегляду файлу (винесена за межі умови редагування)
  const handleFileClick = (file: FileWithStatus) => {
    if (file.status === 'success' || !file.status) { // дозволяємо перегляд для всіх завершених файлів
      setSelectedFile(file);
    }
  };

  return (
    <div className="flex flex-col flex-1 relative bg-gray-50/50">
      <div className="flex-1 overflow-y-auto pb-[72px] w-full">
        <div className="bg-white pb-4 mb-4 px-6">
          <div className="relative w-full text-sm bg-white min-h-[120px] prose prose-sm max-w-[1200px] mx-auto">
            <button
              onClick={() => setIsEditing(!isEditing)}
              className={cn(
                "absolute top-2 right-2 z-20",
                "p-2 rounded-lg transition-colors",
                isEditing
                  ? "bg-indigo-100 text-indigo-600 hover:bg-indigo-200"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              )}
              title={isEditing ? "Finish editing" : "Start editing"}
            >
              <Pencil className="w-4 h-4" />
            </button>

            <div className="relative">
              {/* Toolbar з кнопкою додавання файлів */}
              {isEditing && (
                <div className="mb-2 border-b border-gray-100 pb-2">
                  <div className="flex items-center gap-2">
                    <RichTextToolbar editor={editor} />
                    <label className="flex items-center gap-1 px-2 py-1 cursor-pointer text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded-md transition-colors text-sm">
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        className="hidden"
                        multiple
                        accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
                      />
                      <Paperclip className="w-4 h-4" />
                      <span>Attach</span>
                    </label>
                  </div>
                </div>
              )}

              {/* Редактор з overlay тільки для тексту */}
              <div className="relative">
                {!isEditing && (
                  <div 
                    className="absolute inset-0 bg-gray-50/10 z-10" 
                    style={{ bottom: files.length > 0 ? '40px' : '0' }} // Зменшуємо висоту overlay
                  />
                )}
                
                <EditorContent 
                  editor={editor}
                  className={cn(
                    isEditing && "cursor-text",
                    !isEditing && "cursor-default"
                  )}
                />
              </div>

              {/* Секція файлів винесена за межі області з overlay */}
              {files.length > 0 && (
                <div className="relative z-20 border-t border-gray-100 pt-2 mt-2">
                  {shouldExpandList ? (
                    // Для більше ніж 4 файлів - показуємо кнопку розгортання
                    <>
                      <button
                        onClick={() => setShowFiles(!showFiles)}
                        className="flex items-center gap-1.5 text-gray-600 hover:text-gray-900"
                      >
                        <ChevronRight className={cn(
                          "w-3.5 h-3.5 transition-transform",
                          showFiles && "rotate-90"
                        )} />
                        <Paperclip className="w-3.5 h-3.5" />
                        <span className="text-sm">
                          {files.length} {files.length === 1 ? 'attachment' : 'attachments'}
                        </span>
                      </button>

                      {showFiles && (
                        <div className="grid gap-2 md:grid-cols-2 mt-2 pl-5">
                          {files.map((file, index) => (
                            <div
                              key={file.id || index}
                              onClick={() => handleFileClick(file)}
                              className={cn(
                                "inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all duration-200",
                                "border shadow-sm hover:shadow-md cursor-pointer",
                                file.status === 'uploading' && "bg-blue-50",
                                file.status === 'success' && "bg-white hover:bg-gray-50",
                                file.status === 'error' && "bg-red-50",
                                !file.status && "bg-gray-50",
                                "group"
                              )}
                            >
                              <div className="flex items-center gap-2">
                                {file.status === 'uploading' ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500" />
                                ) : file.type?.startsWith('image/') ? (
                                  <Image className="w-4 h-4 text-indigo-500" />
                                ) : file.type?.includes('pdf') ? (
                                  <FileText className="w-4 h-4 text-indigo-500" />
                                ) : (
                                  <File className="w-4 h-4 text-indigo-500" />
                                )}
                                <span className="truncate max-w-[180px]">{file.name}</span>
                              </div>
                              {isEditing && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteAttachment(index);
                                  }}
                                  className={cn(
                                    "p-1.5 rounded-lg transition-all duration-200",
                                    "opacity-0 group-hover:opacity-100",
                                    "text-gray-400 hover:text-red-500 hover:bg-red-50"
                                  )}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    // Для 4 або менше файлів
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm text-gray-600 flex items-center gap-1.5">
                        <Paperclip className="w-3.5 h-3.5" />
                        Attachments:
                      </span>
                      {files.map((file, index) => (
                        <div
                          key={file.id || index}
                          onClick={() => handleFileClick(file)}
                          className={cn(
                            "inline-flex items-center gap-2 px-2 py-1 rounded-md text-sm transition-all duration-200",
                            "border shadow-sm hover:shadow-md cursor-pointer",
                            file.status === 'uploading' && "bg-blue-50",
                            file.status === 'success' && "bg-white hover:bg-gray-50",
                            file.status === 'error' && "bg-red-50",
                            !file.status && "bg-gray-50",
                            "group"
                          )}
                        >
                          <div className="flex items-center gap-1.5">
                            {file.status === 'uploading' ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500" />
                            ) : file.type?.startsWith('image/') ? (
                              <Image className="w-3.5 h-3.5 text-indigo-500" />
                            ) : file.type?.includes('pdf') ? (
                              <FileText className="w-3.5 h-3.5 text-indigo-500" />
                            ) : (
                              <File className="w-3.5 h-3.5 text-indigo-500" />
                            )}
                            <span className="truncate max-w-[120px]">{file.name}</span>
                          </div>
                          {isEditing && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteAttachment(index);
                              }}
                              className={cn(
                                "p-1 rounded-lg transition-all duration-200",
                                "opacity-0 group-hover:opacity-100",
                                "text-gray-400 hover:text-red-500 hover:bg-red-50"
                              )}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Індикатор завантаження */}
                  {isUploading && (
                    <div className="mt-2 pl-5">
                      <UploadingAnimation />
                    </div>
                  )}

                  {/* Повідомлення про успіх */}
                  {showSuccessMessage && (
                    <div className="mt-1 pl-5 animate-in fade-in slide-in-from-top duration-300">
                      <p className="text-xs text-emerald-600 flex items-center">
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        Files uploaded successfully
                      </p>
                    </div>
                  )}

                  {/* Повідомлення про помилку */}
                  {uploadStatus === 'error' && !isUploading && (
                    <div className="mt-1 pl-5">
                      <p className="text-xs text-red-600 flex items-center">
                        <AlertCircle className="w-3 h-3 mr-1" />
                        {error || 'Failed to upload files'}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {task.result && (
          <div className="mb-6">
            <TaskResultDisplay result={task.result} files={task.files || []} />
          </div>
        )}
        
        {!task.is_subtask && (
          <div className="mb-8">
            <SubtaskList 
              parentTask={task} 
              onSubtaskCreated={onSubtaskCreated} 
              isQuickTaskOpen={isQuickTaskOpen}
              setIsQuickTaskOpen={setIsQuickTaskOpen}
              statuses={statuses}
            />
          </div>
        )}
        
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-2">{t('tasks.taskDetails.activity')}</h3>
          <ActivityList taskId={task.id} users={users} />
        </div>
      </div>

      {/* Modal для перегляду файлів */}
      <Modal 
        isOpen={!!selectedFile} 
        onClose={() => setSelectedFile(null)}
      >
        {selectedFile && (
          <FileViewer
            file={selectedFile}
            onClose={() => setSelectedFile(null)}
          />
        )}
      </Modal>

      {isQuickTaskOpen && (
        <QuickTaskModal
          isOpen={isQuickTaskOpen}
          onClose={() => setIsQuickTaskOpen(false)}
          onSuccess={() => {
            setIsQuickTaskOpen(false);
            onSubtaskCreated?.();
          }}
          statuses={statuses}
          users={users}
          parentTaskId={task.id}
        />
      )}
    </div>
  );
}