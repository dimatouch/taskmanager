import { useState } from 'react';
import { FileText, ExternalLink, X, Loader2, Image as ImageIcon } from 'lucide-react';
import { cn } from '../../../../lib/utils';
import { useTranslation } from '../../../../lib/i18n/useTranslation';

interface FileViewerProps {
  file: {
    name: string;
    url: string;
    type?: string;
  };
  onClose: () => void;
}

export function FileViewer({ file, onClose }: FileViewerProps) {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);

  const isPDF = file.type?.includes('pdf');
  const isImage = file.type?.startsWith('image/');

  // Add #toolbar=0 to disable PDF toolbar and #view=FitH to fit to width
  const pdfUrl = isPDF ? `${file.url}#toolbar=0&view=FitH` : file.url;

  if (isImage) {
    return (
      <div className="p-4">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-75">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
          </div>
        )}
        <img
          src={file.url}
          alt={file.name}
          className="max-w-full h-auto rounded-lg"
          onLoad={() => setIsLoading(false)}
          onError={() => setError(true)}
        />
      </div>
    );
  }

  if (isPDF) {
    return (
      <div className="p-4">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-75">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
          </div>
        )}
        
        {error ? (
          <div className="flex flex-col items-center justify-center p-8 bg-gray-50 rounded-lg">
            <FileText className="w-16 h-16 text-gray-400 mb-4" />
            <p className="text-sm text-gray-600 mb-4">
              {t('tasks.taskDetails.pdfPreviewFallback')}
            </p>
            <div className="flex items-center gap-3">
              <a
                href={file.url}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  "px-4 py-2 text-sm font-medium rounded-lg",
                  "bg-indigo-600 text-white hover:bg-indigo-700",
                  "shadow-sm hover:shadow transition-all"
                )}
              >
                <ExternalLink className="w-4 h-4 inline-block mr-2" />
                {t('tasks.taskDetails.openInNewWindow')}
              </a>
            </div>
          </div>
        ) : (
          <object
            data={pdfUrl}
            type="application/pdf"
            className="w-full h-[600px] rounded-lg"
            onLoad={() => setIsLoading(false)}
            onError={() => setError(true)}
          >
            <iframe
              src={pdfUrl}
              className="w-full h-full rounded-lg"
              onLoad={() => setIsLoading(false)}
              onError={() => setError(true)}
            />
          </object>
        )}
      </div>
    );
  }

  // Для інших типів файлів
  return (
    <div className="flex flex-col items-center justify-center p-8 bg-gray-50 rounded-lg">
      <FileText className="w-16 h-16 text-gray-400 mb-4" />
      <p className="text-sm text-gray-600 mb-4">
        This file type cannot be previewed
      </p>
      <div className="flex items-center gap-3">
        <a
          href={file.url}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            "px-4 py-2 text-sm font-medium rounded-lg",
            "bg-indigo-600 text-white hover:bg-indigo-700",
            "shadow-sm hover:shadow transition-all"
          )}
        >
          <ExternalLink className="w-4 h-4 inline-block mr-2" />
          Download
        </a>
      </div>
    </div>
  );
} 