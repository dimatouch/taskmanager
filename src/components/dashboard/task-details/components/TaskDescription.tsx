import { ClipboardList, Paperclip, X, Loader2, FileText, Image, File, Plus, ExternalLink, CheckCircle2, AlertCircle, Trash2 } from 'lucide-react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import React, { useState, useRef, useEffect } from 'react';
import { PDFViewer } from './PDFViewer';
import { cn, sanitizeFilename } from '../../../../lib/utils';
import { RichTextToolbar } from './RichTextToolbar';
import { useTranslation } from '../../../../lib/i18n/useTranslation'; 
import { supabase } from '../../../../lib/supabase';
import { taskActivityService } from '../../../../services/taskActivityService';

interface TaskDescriptionProps {
  editor: EditorContent | null;
  taskId: string;
  isSubtask?: boolean;
}

interface Attachment {
  id: string;
  name: string;
  url: string;
  size: number;
  type: string;
  status?: 'uploading' | 'success' | 'error';
}

export function TaskDescription({ editor: externalEditor, taskId, isSubtask }: TaskDescriptionProps) {
  const { t } = useTranslation();
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [showAttachments, setShowAttachments] = useState(false);
  const [selectedFile, setSelectedFile] = useState<Attachment | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState<'uploading' | 'success' | 'error' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const attachmentsContainerRef = useRef<HTMLDivElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit,
      TaskList.configure({
        HTMLAttributes: {
          class: 'task-list-container',
        },
      }),
      TaskItem.configure({
        nested: true,
        HTMLAttributes: {
          class: 'task-item',
        },
      }),
    ],
    content: '',
    editorProps: {
      attributes: {
        class: 'prose prose-sm focus:outline-none max-w-none',
      },
      handleKeyDown: (view, event) => {
        // Відключаємо стандартну поведінку Enter для збереження
        if (event.key === 'Enter' && !event.shiftKey) {
          return false;
        }
        return false;
      },
    },
    onBlur: ({ editor }) => {
      // Зберігаємо тільки при втраті фокусу
      const content = editor.getHTML();
      // Ваша логіка збереження
      handleSaveDescription(content);
    },
  });

  // Завантаження початкових файлів
  useEffect(() => {
    const loadFiles = async () => {
      try {
        const { data: task } = await supabase
          .from('tasks')
          .select('files')
          .eq('id', taskId)
          .single();

        if (task?.files) {
          setAttachments(task.files);
        }
      } catch (err) {
        console.error('Failed to load files:', err);
        setError('Failed to load files');
      }
    };

    loadFiles();
  }, [taskId]);

  // Обробка кліку поза зоною вкладень для закриття списку
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        attachmentsContainerRef.current &&
        !attachmentsContainerRef.current.contains(event.target as Node)
      ) {
        setShowAttachments(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Скидання file input та помилки
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    setError(null);
    
    // Перевірка розміру файлу (ліміт 50MB)
    if (file.size > 52428800) {
      setError(t('tasks.taskDetails.upload.tooLarge'));
      return;
    }

    try {
      setIsUploading(true);
      setUploadProgress(0);
      setUploadStatus('uploading');
      setError(null);

      // Отримання поточного користувача
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No authenticated user');

      // Створення шляху файлу
      const sanitizedName = sanitizeFilename(file.name);
      const filePath = `${user.id}/${taskId}/${sanitizedName}`;

      // Отримання поточного масиву файлів
      const { data: task } = await supabase
        .from('tasks')
        .select('files')
        .eq('id', taskId)
        .single();

      // Завантаження файлу
      const { data, error } = await supabase.storage
        .from('task-attachments')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true,
          onUploadProgress: (progress) => {
            setUploadProgress((progress.loaded / progress.total) * 100);
          }
        });

      if (error) throw error;

      // Отримання публічного URL
      const { data: { publicUrl } } = supabase.storage
        .from('task-attachments')
        .getPublicUrl(filePath);

      // Створення нового об'єкту файлу
      const newFile = {
        id: data.path,
        name: sanitizedName,
        path: filePath,
        url: publicUrl,
        size: file.size,
        type: file.type,
        uploaded_by: user.id,
        uploaded_at: new Date().toISOString()
      };

      // Додавання нового файлу до масиву файлів
      const newFiles = [...(task?.files || []), newFile];

      // Оновлення задачі з новим масивом файлів
      const { error: updateError } = await supabase
        .from('tasks')
        .update({ files: newFiles })
        .eq('id', taskId);

      if (updateError) throw updateError;

      // Оновлення локального списку вкладень
      const newAttachment = {
        id: data.path,
        name: file.name,
        url: publicUrl,
        size: file.size,
        type: file.type,
        status: 'success'
      };
      
      setAttachments(prev => [...prev, newAttachment]);
      setUploadStatus('success');

      // Логування активності
      await taskActivityService.logActivity({
        taskId,
        field: 'attachment',
        newValue: JSON.stringify(newAttachment),
        type: 'attachment'
      });

    } catch (err) {
      console.error('Failed to upload file:', err);
      setError(err instanceof Error ? err.message : 'Failed to upload file');
      setUploadStatus('error');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteAttachment = async (attachmentId: string) => {
    try {
      // Отримання поточних файлів задачі
      const { data: task } = await supabase
        .from('tasks')
        .select('files')
        .eq('id', taskId)
        .single();

      if (!task) throw new Error('Task not found');

      // Видалення файлу з масиву файлів
      const newFiles = task.files.filter((f: any) => f.id !== attachmentId);
      
      // Оновлення задачі
      const { error: updateError } = await supabase
        .from('tasks')
        .update({ files: newFiles })
        .eq('id', taskId);

      if (updateError) throw updateError;

      // Видалення з сховища
      const { error } = await supabase.storage
        .from('task-attachments')
        .remove([attachmentId]);

      if (error) throw error;

      setAttachments(prev => prev.filter(a => a.id !== attachmentId));

      // Логування активності
      await taskActivityService.logActivity({
        taskId,
        field: 'attachment',
        oldValue: attachmentId,
        type: 'delete'
      });

    } catch (err) {
      console.error('Failed to delete attachment:', err);
    }
  };

  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) return <Image className="w-4 h-4" />;
    if (type.includes('pdf')) return <FileText className="w-4 h-4" />;
    return <File className="w-4 h-4" />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleAttachmentBlockClick = () => {
    if (attachments.length === 0 && fileInputRef.current) {
      fileInputRef.current.click();
    } else {
      setShowAttachments(!showAttachments);
    }
  };

  const handleSaveDescription = async (content: string) => {
    try {
      const { error } = await supabase
        .from('tasks')
        .update({ description: content })
        .eq('id', taskId);

      if (error) throw error;
    } catch (err) {
      console.error('Failed to save description:', err);
    }
  };

  if (!editor) return null;

  return (
    <div className="bg-gradient-to-br from-white to-gray-50/80 border-b pb-4 mb-4 px-6">
      <div className="sticky top-0 bg-white z-20 pb-2 border-b mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
          <div className="w-5 h-5 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 mr-2">
            <ClipboardList className="w-3 h-3" />
          </div>
          {t('tasks.taskDetails.description')}
        </label>
        <RichTextToolbar editor={editor} />
      </div>
      <div
        className={cn(
          "w-full text-sm bg-white border border-gray-200 rounded-lg focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500",
          "shadow-md p-4 min-h-[120px] prose prose-sm",
          "[&_.ProseMirror]:min-h-[120px] [&_.ProseMirror]:outline-none"
        )}
        style={{ lineHeight: '1.8', letterSpacing: '0.01em' }}
      >
        <EditorContent editor={editor} />
      </div>
      
      {/* Секція вкладень */}
      <div className="mt-4 space-y-4" ref={attachmentsContainerRef}>
        <div 
          className={cn(
            "relative flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-colors",
            attachments.length === 0 ? "hover:bg-gray-50 hover:border-gray-300" : "hover:bg-gray-50",
            error ? "border-red-300 bg-red-50" : "border-gray-200"
          )}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              handleAttachmentBlockClick();
            }
          }}
        >
          <div className="flex items-center gap-2 text-gray-500">
            <div className="relative">
              <Paperclip className="w-5 h-5" />
              {attachments.length > 0 && (
                <div className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-indigo-100 rounded-full flex items-center justify-center">
                  <span className="text-[10px] font-medium text-indigo-600">
                    {attachments.length}
                  </span>
                </div>
              )}
            </div>
            <span className="text-sm">
              {attachments.length === 0 
                ? t('tasks.taskDetails.addAttachment')
                : t('tasks.taskDetails.attachments')}
            </span>
          </div>

          {/* Кнопка додавання файлу */}
          <div 
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              fileInputRef.current?.click();
            }}
            className={cn(
              "ml-auto p-1.5 rounded-md transition-colors cursor-pointer",
              "text-gray-500 hover:text-gray-700 hover:bg-gray-100"
            )}
            title={t('tasks.taskDetails.addMore')}
          >
            <Plus className="w-4 h-4" />
          </div>

          {/* Індикатор завантаження/статусу */}
          {uploadStatus && (
            <div className={cn(
              "p-1.5 rounded-lg transition-colors",
              uploadStatus === 'uploading' && "bg-blue-50 text-blue-600",
              uploadStatus === 'success' && "bg-emerald-50 text-emerald-600",
              uploadStatus === 'error' && "bg-red-50 text-red-600"
            )}>
              {uploadStatus === 'uploading' && (
                <Loader2 className="w-5 h-5 animate-spin" />
              )}
              {uploadStatus === 'success' && (
                <CheckCircle2 className="w-5 h-5" />
              )}
              {uploadStatus === 'error' && (
                <AlertCircle className="w-5 h-5" />
              )}
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={(e) => {
              e.stopPropagation();
              handleFileUpload(e);
            }}
            disabled={isUploading}
          />
          
          {/* Список вкладень */}
          {showAttachments && attachments.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg border shadow-lg z-10 max-h-[300px] overflow-y-auto">
              {attachments.map(attachment => (
                <div
                  key={attachment.id}
                  className="flex items-center justify-between p-3 hover:bg-gray-50 group border-b last:border-b-0 cursor-pointer"
                  onClick={() => setSelectedFile(attachment)}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className={cn(
                      "w-8 h-8 rounded-lg flex items-center justify-center",
                      attachment.type.startsWith('image/') && "bg-blue-100",
                      attachment.type.includes('pdf') && "bg-red-100",
                      !attachment.type.startsWith('image/') && !attachment.type.includes('pdf') && "bg-gray-100"
                    )}>
                      {getFileIcon(attachment.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {attachment.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatFileSize(attachment.size)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Кнопка попереднього перегляду */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedFile(attachment);
                      }}
                      className="p-1.5 rounded-lg text-gray-400 opacity-0 group-hover:opacity-100 hover:bg-indigo-50 hover:text-indigo-500 transition-all"
                      title={t('tasks.taskDetails.previewFile')}
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    </button>
                    
                    {/* Кнопка "Відкрити в новому вікні" */}
                    <a
                      href={attachment.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="p-1.5 rounded-lg text-gray-400 opacity-0 group-hover:opacity-100 hover:bg-blue-50 hover:text-blue-500 transition-all"
                      title={t('tasks.taskDetails.openInNewWindow')}
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                    
                    {/* Кнопка видалення (з іконкою корзини) */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteAttachment(attachment.id);
                      }}
                      className="p-1.5 rounded-lg text-gray-400 opacity-0 group-hover:opacity-100 hover:bg-red-50 hover:text-red-500 transition-all"
                      title={t('tasks.taskDetails.deleteAttachment')}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Індикатор прогресу завантаження */}
        {isUploading && (
          <div className="mt-2 animate-in slide-in-from-top duration-300">
            <div className="h-1 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              <Loader2 className="w-3 h-3 inline-block mr-1 animate-spin" />
              {t('tasks.taskDetails.upload.inProgress')} ({Math.round(uploadProgress)}%) 
            </p>
          </div>
        )}
        
        {/* Повідомлення про успішне завантаження */}
        {uploadStatus === 'success' && !isUploading && (
          <div className="mt-2 animate-in slide-in-from-top duration-300">
            <p className="text-xs text-emerald-600 flex items-center">
              <CheckCircle2 className="w-3 h-3 mr-1" />
              {t('tasks.taskDetails.upload.success')}
            </p>
          </div>
        )}
        
        {/* Повідомлення про помилку */}
        {uploadStatus === 'error' && !isUploading && (
          <div className="mt-2 animate-in slide-in-from-top duration-300">
            <p className="text-xs text-red-600 flex items-center">
              <AlertCircle className="w-3 h-3 mr-1" />
              {t('tasks.taskDetails.upload.error')}
            </p>
          </div>
        )}

        {/* Модальне вікно попереднього перегляду файлу */}
        {selectedFile && (
          <div className="fixed inset-0 bg-black/30 backdrop-blur-[2px] flex items-center justify-center p-4 z-[70] animate-in fade-in duration-200">
            <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full">
              <div className="p-4 border-b flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center",
                    selectedFile.type.startsWith('image/') && "bg-blue-100",
                    selectedFile.type.includes('pdf') && "bg-red-100",
                    !selectedFile.type.startsWith('image/') && !selectedFile.type.includes('pdf') && "bg-gray-100"
                  )}>
                    {getFileIcon(selectedFile.type)}
                  </div>
                  <div>
                    <h3 className="text-lg font-medium text-gray-900">
                      {selectedFile.name}
                    </h3>
                    <p className="text-sm text-gray-500">
                      {formatFileSize(selectedFile.size)}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedFile(null)}
                  className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-500"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-4">
                {selectedFile.type.startsWith('image/') ? (
                  <img
                    src={selectedFile.url}
                    alt={selectedFile.name}
                    className="max-w-full h-auto rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                  />
                ) : selectedFile.type.includes('pdf') ? (
                  <div className="relative h-[600px]">
                    <PDFViewer
                      file={selectedFile}
                      onClose={() => setSelectedFile(null)}
                    />
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <File className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                    <p className="text-sm text-gray-500">
                      Preview not available for this file type
                    </p>
                  </div>
                )}
              </div>
              <div className="p-4 bg-gray-50 border-t flex justify-end">
                <div className="flex items-center gap-3">
                  <a
                    href={selectedFile.url}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className={cn(
                      "px-4 py-2 text-sm font-medium rounded-lg",
                      "bg-gray-100 text-gray-700 hover:bg-gray-200",
                      "shadow-sm hover:shadow transition-all"
                    )}
                  >
                    <ExternalLink className="w-4 h-4 inline-block mr-2" />
                    {t('tasks.taskDetails.openInNewWindow')}
                  </a>
                  <a
                    href={selectedFile.url}
                    download={selectedFile.name}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className={cn(
                      "px-4 py-2 text-sm font-medium rounded-lg",
                      "bg-indigo-600 text-white hover:bg-indigo-700",
                      "shadow-sm hover:shadow transition-all"
                    )}
                  >
                    {t('tasks.taskDetails.downloadAttachment')}
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
