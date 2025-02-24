import { useState } from 'react';
import { FileText, ExternalLink, X, Loader2 } from 'lucide-react';
import { cn } from '../../../../lib/utils';
import { useTranslation } from '../../../../lib/i18n/useTranslation';

interface PDFViewerProps {
  file: {
    name: string;
    url: string;
  };
  onClose: () => void;
}

export function PDFViewer({ file, onClose }: PDFViewerProps) {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);

  // Add #toolbar=0 to disable PDF toolbar and #view=FitH to fit to width
  const pdfUrl = `${file.url}#toolbar=0&view=FitH`;

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