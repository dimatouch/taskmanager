import { useState } from 'react';
import { FileText, Image, File, ExternalLink, X, CheckCircle2 } from 'lucide-react';
import { cn } from '../../../../lib/utils';
import { PDFViewer } from './PDFViewer';

interface TaskResultDisplayProps {
  result: string;
  files: any[];
}

export function TaskResultDisplay({ result, files }: TaskResultDisplayProps) {
  const [selectedFile, setSelectedFile] = useState<any | null>(null);
  const [isExpanded, setIsExpanded] = useState(true);

  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) return <Image className="w-5 h-5 text-blue-500" />;
    if (type.includes('pdf')) return <FileText className="w-5 h-5 text-red-500" />;
    return <File className="w-5 h-5 text-gray-500" />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="bg-white rounded-lg border shadow-sm hover:shadow-md transition-all overflow-hidden mb-6 mx-6">
      <div>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full px-4 py-3 bg-gradient-to-br from-emerald-50 to-emerald-50/50 border-b flex items-center justify-between group hover:bg-emerald-50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <h3 className="text-sm font-medium text-emerald-900">Результат виконання</h3>
            {files?.length > 0 && (
              <span className="text-xs text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full">
                {files.length} {files.length === 1 ? 'файл' : 'файли'}
              </span>
            )}
          </div>
          <div className={cn(
            "w-5 h-5 rounded-full bg-white flex items-center justify-center transition-transform duration-200",
            "text-emerald-600",
            isExpanded ? "rotate-180" : "rotate-0"
          )}>
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </button>

        <div className={cn(
          "transition-all duration-200 origin-top",
          isExpanded ? "p-4 space-y-4" : "h-0 p-0 overflow-hidden"
        )}>
          {/* Result Content */}
          <div 
            className="prose prose-sm max-w-none"
            dangerouslySetInnerHTML={{ __html: result }}
          />

          {/* Files */}
          {files?.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-gray-700 mb-2">
                Прикріплені файли ({files.length})
              </h4>
              <div className="grid gap-2">
                {files.map((file) => (
                  <div
                    key={file.id}
                    className="flex items-center justify-between p-3 bg-gray-50/50 rounded-lg border hover:shadow-sm transition-shadow group"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className={cn(
                        "w-8 h-8 rounded-lg flex items-center justify-center",
                        file.type.startsWith('image/') && "bg-blue-100",
                        file.type.includes('pdf') && "bg-red-100",
                        !file.type.startsWith('image/') && !file.type.includes('pdf') && "bg-gray-100"
                      )}>
                        {getFileIcon(file.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {file.name}
                        </p>
                        <p className="text-xs text-gray-500">
                          {formatFileSize(file.size)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      {/* Preview button */}
                      <button
                        onClick={() => setSelectedFile(file)}
                        className="p-1.5 rounded-lg text-gray-400 hover:bg-indigo-50 hover:text-indigo-500 transition-colors"
                      >
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      </button>
                      
                      {/* Open in new window button */}
                      <a
                        href={file.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 rounded-lg text-gray-400 hover:bg-blue-50 hover:text-blue-500 transition-colors"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* File Preview Modal */}
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
                  Open in New Window
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
                  Download
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}