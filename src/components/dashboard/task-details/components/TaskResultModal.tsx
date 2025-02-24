import { useState, useRef, useEffect } from 'react';
import {
  X,
  CheckCircle2,
  Loader2,
  AlertCircle,
  Plus,
  File,
  FileText,
  Image,
} from 'lucide-react';
import { cn, sanitizeFilename } from '../../../../lib/utils';
import { useTranslation } from '../../../../lib/i18n/useTranslation';
import { RichTextToolbar } from './RichTextToolbar';
import { useEditor, EditorContent } from '@tiptap/react';
import { extensions } from '../extensions';
import { supabase } from '../../../../lib/supabase';
import { taskActivityService } from '../../../../services/taskActivityService';

interface TaskResultModalProps {
  resultInput: string;
  onResultChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onClose: () => void;
  onComplete: () => void;
  isSubmitting: boolean;
  error?: string | null;
  task: {
    id: string;
    files?: any[]; // старі файли не відображаємо
  };
  files: File[];
  onFileChange: (files: File[]) => void;
}

interface Attachment {
  id: string;
  name: string;
  url: string;
  size: number;
  type: string;
  path: string;
}

export function TaskResultModal({
  resultInput,
  onResultChange,
  onClose,
  onComplete,
  isSubmitting,
  error,
  task,
  files,
  onFileChange,
}: TaskResultModalProps) {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Стан для **нових** вкладень (щоб не змішувати зі старими task.files)
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState<'uploading' | 'success' | 'error' | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Редактор для результату
  const editor = useEditor({
    extensions,
    content: resultInput,
    onUpdate: ({ editor }) => {
      onResultChange({ target: { value: editor.getHTML() } } as any);
    },
  });

  // Логіка завантаження НОВИХ файлів
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []);
    if (selected.length === 0) return;

    // Очистимо інпут, щоби можна було вибрати ті самі файли знову (якщо потрібно)
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    setUploadError(null);

    // Передаємо їх батьківському компоненту (якщо потрібно)
    onFileChange([...files, ...selected]);

    for (const file of selected) {
      // Перевірка розміру
      if (file.size > 52428800) {
        setUploadError(t('tasks.taskDetails.upload.tooLarge'));
        continue;
      }

      try {
        setIsUploading(true);
        setUploadProgress(0);
        setUploadStatus('uploading');

        // Користувач
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('No authenticated user');

        // Формуємо шлях
        const sanitizedName = sanitizeFilename(file.name);
        const filePath = `${user.id}/${task.id}/${sanitizedName}`;

        // Завантажуємо
        const { data, error: uploadError } = await supabase.storage
          .from('task-attachments')
          .upload(filePath, file, {
            cacheControl: '3600',
            upsert: true,
            onUploadProgress: (progress) => {
              setUploadProgress((progress.loaded / progress.total) * 100);
            },
          });

        if (uploadError) throw uploadError;

        // Публічне посилання
        const { data: { publicUrl } } = supabase.storage
          .from('task-attachments')
          .getPublicUrl(filePath);

        // Створюємо об'єкт для нового файлу
        const newFile: Attachment = {
          id: data.path,
          name: sanitizedName,
          path: filePath,
          url: publicUrl,
          size: file.size,
          type: file.type,
        };

        // Зчитуємо поточні файли з БД (щоб зберегти старі, але не показувати їх тут)
        const { data: taskData } = await supabase
          .from('tasks')
          .select('files')
          .eq('id', task.id)
          .single();

        // Оновлюємо "files" в БД (старі + нові)
        const updatedFiles = [...(taskData?.files || []), newFile];

        const { error: updateError } = await supabase
          .from('tasks')
          .update({ files: updatedFiles })
          .eq('id', task.id);
        if (updateError) throw updateError;

        // Додаємо лише до локального стейту нових файлів
        setAttachments((prev) => [...prev, newFile]);
        setUploadStatus('success');

        // Логування
        await taskActivityService.logActivity({
          taskId: task.id,
          field: 'attachment',
          newValue: JSON.stringify(newFile),
          type: 'attachment',
        });
      } catch (err) {
        console.error('Failed to upload file:', err);
        setUploadError(err instanceof Error ? err.message : 'Failed to upload file');
        setUploadStatus('error');
      }
    }
    setIsUploading(false);
  };

  // Видалення НОВОГО файлу
  const handleDeleteAttachment = async (attachmentId: string) => {
    try {
      // Зчитуємо поточні файли з БД
      const { data: currentTask } = await supabase
        .from('tasks')
        .select('files')
        .eq('id', task.id)
        .single();

      if (!currentTask) throw new Error('Task not found');

      // Видаляємо потрібний файл з масиву
      const newFiles = (currentTask.files || []).filter((f: any) => f.id !== attachmentId);

      // Оновлюємо
      const { error: updateError } = await supabase
        .from('tasks')
        .update({ files: newFiles })
        .eq('id', task.id);
      if (updateError) throw updateError;

      // Видаляємо зі storage
      const { error } = await supabase.storage
        .from('task-attachments')
        .remove([attachmentId]);
      if (error) throw error;

      // Видаляємо з локального стейту
      setAttachments((prev) => prev.filter((a) => a.id !== attachmentId));

      // Логування
      await taskActivityService.logActivity({
        taskId: task.id,
        field: 'attachment',
        oldValue: attachmentId,
        type: 'delete',
      });
    } catch (err) {
      console.error('Failed to delete attachment:', err);
      setUploadError(err instanceof Error ? err.message : 'Failed to delete attachment');
      setUploadStatus('error');
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-[2px] flex items-center justify-center p-4 z-[60] animate-in fade-in duration-200">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl">
        {/* Header */}
        <div className="px-6 py-4 flex items-center justify-between border-b bg-gradient-to-r from-emerald-50 to-white">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                {t('tasks.completeTask')}
              </h3>
              <p className="text-sm text-gray-500 mt-0.5">
                Опишіть результати та досягнення
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-500"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">
          {/* Результат (RichText) */}
          <div>
            <label htmlFor="result" className="block text-sm font-medium text-gray-700 mb-1">
              {t('tasks.taskResult')}
            </label>
            <p className="text-sm text-gray-500 mb-4">
              {t('tasks.taskDetails.enterResult')}
            </p>
            {error && (
              <div className="mb-4 rounded-lg bg-red-50 p-4 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}
            <div className="bg-white border rounded-lg shadow-sm transition-all">
              <RichTextToolbar editor={editor} />
              <div
                className="min-h-[200px] cursor-text focus-within:ring-0 focus-within:outline-none"
                onClick={() => editor?.commands.focus()}
              >
                <EditorContent
                  editor={editor}
                  className={cn(
                    "prose prose-sm p-4 w-full max-w-none [&_*:focus]:outline-none [&_.ProseMirror]:focus:outline-none [&_.ProseMirror]:focus:ring-0",
                    "prose-headings:font-semibold prose-h1:text-2xl prose-h2:text-xl prose-h3:text-lg",
                    "prose-p:my-2 prose-blockquote:border-l-2 prose-blockquote:border-gray-300 prose-blockquote:pl-4",
                    "prose-pre:bg-gray-100 prose-pre:p-4 prose-pre:rounded-lg",
                    "prose-ul:list-disc prose-ol:list-decimal prose-li:my-1"
                  )}
                />
              </div>
            </div>

            {/* Файли, які додаються ЗАРАЗ (без старих) */}
            <div className="mt-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Прикріпити файли (нові) – {attachments.length}
              </label>
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.jpg,.jpeg,.png,.gif"
                multiple
                onChange={handleFileUpload}
              />
              <div className="flex flex-wrap gap-3 mb-3">
                {attachments.map((file) => (
                  <div
                    key={file.id}
                    className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 rounded-lg"
                  >
                    {file.type.startsWith('image/') ? (
                      <Image className="w-4 h-4 text-blue-500" />
                    ) : file.type.includes('pdf') ? (
                      <FileText className="w-4 h-4 text-red-500" />
                    ) : (
                      <File className="w-4 h-4 text-gray-500" />
                    )}
                    <span className="text-sm text-gray-600">
                      {file.name}
                      <span className="text-gray-400 ml-2">
                        ({formatFileSize(file.size)})
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDeleteAttachment(file.id)}
                      className="p-1 hover:bg-gray-200 rounded-full text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className={cn(
                    "px-4 py-2 text-sm font-medium rounded-lg transition-colors",
                    "text-gray-600 hover:text-gray-700",
                    "bg-gray-100 hover:bg-gray-200",
                    "flex items-center gap-2",
                    "disabled:opacity-50 disabled:cursor-not-allowed"
                  )}
                >
                  {isUploading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4" />
                  )}
                  {t('tasks.taskDetails.addAttachment')}
                </button>
              </div>

              {/* Upload Progress */}
              {isUploading && (
                <div className="mt-2">
                  <div className="h-1 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                    <Loader2 className="w-3 h-3 inline-block animate-spin" />
                    {t('tasks.taskDetails.upload.inProgress')} ({Math.round(uploadProgress)}%)
                  </p>
                </div>
              )}

              {/* Upload Status Messages */}
              {uploadStatus === 'success' && !isUploading && (
                <p className="text-xs text-emerald-600 mt-2 flex items-center">
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  {t('tasks.taskDetails.upload.success')}
                </p>
              )}
              {uploadStatus === 'error' && !isUploading && (
                <p className="text-xs text-red-600 mt-2 flex items-center">
                  <AlertCircle className="w-3 h-3 mr-1" />
                  {uploadError || t('tasks.taskDetails.upload.error')}
                </p>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 mt-8 pt-6 border-t">
            <button
              type="button"
              onClick={onClose}
              className={cn(
                "px-4 py-2 text-sm font-medium rounded-lg transition-colors",
                "text-gray-700 hover:text-gray-500",
                "bg-gray-100 hover:bg-gray-200"
              )}
            >
              {t('common.cancel')}
            </button>
            <button
              type="button"
              onClick={onComplete}
              disabled={isSubmitting || !resultInput.trim() || isUploading}
              className={cn(
                "px-4 py-2 text-sm font-medium rounded-lg",
                "bg-gradient-to-r from-emerald-600 to-teal-600 text-white",
                "hover:from-emerald-500 hover:to-teal-500",
                "shadow-sm hover:shadow",
                "disabled:opacity-50 disabled:cursor-not-allowed",
                "flex items-center gap-2"
              )}
            >
              {isSubmitting || isUploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {isUploading
                    ? t('tasks.taskDetails.upload.inProgress')
                    : t('tasks.taskDetails.taskCompleted')}
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  {t('tasks.completeTask')}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
