import { useState, useRef, useEffect } from 'react';
import { Video, Play, Square, Loader2, Plus, Trash2, AlertCircle, ChevronRight } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { cn } from '../lib/utils';
import { QuickTaskModal } from '../components/dashboard/QuickTaskModal';
import { useTranslation } from '../lib/i18n/useTranslation';

interface Recording {
  id: string;
  title: string;
  url: string;
  created_at: string;
  user_id: string;
  duration: number;
  converted_to_task: boolean;
  task_id?: string;
}

export function ScreenRecordingsPage() {
  const { t } = useTranslation();
  const [isRecording, setIsRecording] = useState(false);
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isQuickTaskOpen, setIsQuickTaskOpen] = useState(false);
  const [selectedRecording, setSelectedRecording] = useState<Recording | null>(null);
  const [statuses, setStatuses] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const timerRef = useRef<NodeJS.Timeout>();
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    const init = async () => {
      try {
        setIsLoading(true);
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          setError('Please sign in to view recordings');
          return;
        }

        const { data: recordings, error } = await supabase
          .from('recordings')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) throw error;
        setRecordings(recordings || []);

        // Fetch statuses and users for task creation
        const [statusesData, usersData] = await Promise.all([
          supabase.from('task_statuses').select('*').order('position'),
          supabase.from('user_profiles').select('*')
        ]);

        setStatuses(statusesData.data || []);
        setUsers(usersData.data || []);
      } catch (err) {
        console.error('Failed to fetch recordings:', err);
        setError(err instanceof Error ? err.message : 'Failed to load recordings');
      } finally {
        setIsLoading(false);
        setIsInitialized(true);
      }
    };

    init();
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { 
          cursor: "always",
          frameRate: 30
        },
        audio: true
      });

      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: 'video/webm' });
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const fileName = `recording-${Date.now()}.webm`;
        const filePath = `${user.id}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('recordings')
          .upload(filePath, blob);

        if (uploadError) {
          console.error('Failed to upload recording:', uploadError);
          return;
        }

        const { data: { publicUrl } } = supabase.storage
          .from('recordings')
          .getPublicUrl(filePath);

        const { error: dbError } = await supabase
          .from('recordings')
          .insert({
            title: `Recording ${new Date().toLocaleString()}`,
            url: publicUrl,
            user_id: user.id,
            duration: recordingTime
          });

        if (dbError) {
          console.error('Failed to save recording:', dbError);
        }

        if (isInitialized) {
          const { data: recordings } = await supabase
            .from('recordings')
            .select('*')
            .order('created_at', { ascending: false });
          setRecordings(recordings || []);
        }
      };

      setMediaRecorder(recorder);
      recorder.start();
      setIsRecording(true);

      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

    } catch (err) {
      console.error('Failed to start recording:', err);
      setError('Failed to start recording. Please check your permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
      mediaRecorder.stream.getTracks().forEach(track => track.stop());
      setMediaRecorder(null);
      setIsRecording(false);
      clearInterval(timerRef.current);
      setRecordingTime(0);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleCreateTask = (recording: Recording) => {
    setSelectedRecording(recording);
    setIsQuickTaskOpen(true);
  };

  const handleDelete = async (recordingId: string) => {
    try {
      setIsDeleting(recordingId);
      
      // Get recording details
      const { data: recording } = await supabase
        .from('recordings')
        .select('url')
        .eq('id', recordingId)
        .single();

      if (recording) {
        // Extract file path from URL
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const filePath = `${user.id}/${recording.url.split('/').pop()}`;

        // Delete from storage
        const { error: storageError } = await supabase.storage
          .from('recordings')
          .remove([filePath]);

        if (storageError) {
          console.error('Failed to delete recording file:', storageError);
        }
      }

      // Delete from database
      const { error: dbError } = await supabase
        .from('recordings')
        .delete()
        .eq('id', recordingId);

      if (dbError) throw dbError;

      // Update recordings list
      setRecordings(prev => prev.filter(r => r.id !== recordingId));
    } catch (err) {
      console.error('Failed to delete recording:', err);
      setError('Failed to delete recording');
    } finally {
      setIsDeleting(null);
      setConfirmDelete(null);
    }
  };

  const handleTaskCreated = async (recordingId: string) => {
    try {
      // Get the most recently created task
      const { data: task } = await supabase
        .from('tasks')
        .select('id')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (task) {
        // Update recording with task reference
        const { error } = await supabase
          .from('recordings')
          .update({ 
            converted_to_task: true,
            task_id: task.id
          })
          .eq('id', recordingId);

        if (error) throw error;

        // Update local state
        setRecordings(prev => prev.map(r => 
          r.id === recordingId 
            ? { ...r, converted_to_task: true, task_id: task.id }
            : r
        ));
      }
    } catch (err) {
      console.error('Failed to update recording:', err);
    } finally {
      setIsQuickTaskOpen(false);
      setSelectedRecording(null);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('recordings.title')}</h1>
          <p className="mt-1 text-sm text-gray-500">
            {t('recordings.subtitle')}
          </p>
        </div>
        <button
          onClick={isRecording ? stopRecording : startRecording}
          className={cn(
            "inline-flex items-center px-4 py-2 rounded-lg transition-all duration-200",
            isRecording
              ? "bg-red-100 text-red-700 hover:bg-red-200"
              : "bg-indigo-600 text-white hover:bg-indigo-700",
            "shadow-sm hover:shadow"
          )}
        >
          {isRecording ? (
            <>
              <Square className="w-5 h-5 mr-2" />
              {t('recordings.stopRecording')} ({formatDuration(recordingTime)})
            </>
          ) : (
            <>
              <Video className="w-5 h-5 mr-2" />
              {t('recordings.startRecording')}
            </>
          )}
        </button>
      </div>

      {error && (
        <div className="mb-8 p-4 bg-red-50 rounded-lg flex items-start gap-2">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {recordings.map(recording => (
          <div
            key={recording.id}
            className="bg-white rounded-lg border shadow-sm hover:shadow-md transition-all p-4"
          >
            <div className="aspect-video bg-gray-100 rounded-lg mb-4 relative group">
              <video
                src={recording.url}
                className="w-full h-full rounded-lg bg-black"
                controls
                controlsList="nodownload"
                onContextMenu={(e) => e.preventDefault()}
              />
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <div className="flex items-center gap-3">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const video = e.currentTarget.closest('.aspect-video')?.querySelector('video');
                      if (video) {
                        video.requestFullscreen();
                      }
                    }}
                    className="px-4 py-2 bg-white rounded-lg text-sm font-medium text-gray-900 hover:bg-gray-50 flex items-center gap-2 whitespace-nowrap"
                  >
                    <svg 
                      className="w-4 h-4" 
                      fill="none" 
                      viewBox="0 0 24 24" 
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path 
                        strokeLinecap="round" 
                        strokeLinejoin="round" 
                        d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" 
                      />
                    </svg>
                    {t('recordings.fullscreen')}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const video = e.currentTarget.closest('.aspect-video')?.querySelector('video');
                      if (video) {
                        if (video.paused) {
                          video.play();
                        } else {
                          video.pause();
                        }
                      }
                    }}
                    className="px-4 py-2 bg-white rounded-lg text-sm font-medium text-gray-900 hover:bg-gray-50 flex items-center gap-2 whitespace-nowrap"
                  >
                    <Play className="w-4 h-4" />
                    {t('recordings.playPause')}
                  </button>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-medium text-gray-900">
                  {recording.title}
                </h3>
                <p className="text-xs text-gray-500 mt-1">
                  {new Date(recording.created_at).toLocaleString()}
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <button
                    onClick={() => handleCreateTask(recording)}
                    disabled={recording.converted_to_task}
                    className={cn(
                      "px-2 py-0.5 text-xs font-medium rounded transition-colors flex items-center gap-1",
                      recording.converted_to_task
                        ? "bg-gray-100 text-gray-500 cursor-not-allowed"
                        : "bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
                    )}
                  >
                    <ChevronRight className="w-3 h-3 flex-shrink-0" />
                    {recording.converted_to_task ? t('recordings.converted') : t('recordings.convertToTask')}
                  </button>
                  {recording.converted_to_task && recording.task_id && (
                    <button
                      onClick={() => navigate(`/tasks/${recording.task_id}`)}
                      className="px-2 py-0.5 text-xs font-medium rounded bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors flex items-center gap-1"
                    >
                      <ChevronRight className="w-3 h-3" />
                      {t('recordings.viewTask')}
                    </button>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setConfirmDelete(recording.id)}
                  className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Delete Confirmation Modal */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-[2px] flex items-center justify-center p-4 z-[60] animate-in fade-in duration-200">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-center w-12 h-12 mx-auto mb-4 rounded-full bg-red-100">
              <AlertCircle className="w-6 h-6 text-red-600" />
            </div>
            <h3 className="text-lg font-medium text-center text-gray-900 mb-2">
              {t('recordings.deleteRecording')}
            </h3>
            <p className="text-sm text-center text-gray-600 mb-6">
              {t('recordings.deleteConfirm')}
            </p>
            <div className="flex justify-center gap-3">
              <button
                onClick={() => setConfirmDelete(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={() => confirmDelete && handleDelete(confirmDelete)}
                disabled={isDeleting !== null}
                className={cn(
                  "px-4 py-2 text-sm font-medium text-white rounded-lg",
                  "bg-red-600 hover:bg-red-700 transition-colors",
                  "disabled:opacity-50 disabled:cursor-not-allowed",
                  "flex items-center"
                )}
              >
                {isDeleting === confirmDelete && (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                )}
                {t('common.delete')}
              </button>
            </div>
          </div>
        </div>
      )}

      {isQuickTaskOpen && selectedRecording && (
        <QuickTaskModal
          isOpen={isQuickTaskOpen}
          onClose={() => {
            setIsQuickTaskOpen(false);
            setSelectedRecording(null);
          }}
          onSuccess={() => {
            selectedRecording && handleTaskCreated(selectedRecording.id);
          }}
          statuses={statuses}
          users={users}
          initialFormState={{
            title: `Task from recording: ${selectedRecording.title}`,
            description: `Recording: ${selectedRecording.url}`,
            status_id: statuses[0]?.id,
            due_date: '',
            project_id: null,
            priority: 0,
            responsible: null,
            coworkers: []
          }}
        />
      )}
    </div>
  );
}