import { useState, useRef } from 'react';
import { Mic, Square, Loader2, AlertCircle } from 'lucide-react';
import { cn } from '../../lib/utils';
import { voiceService } from '../../services/voiceService';

interface VoiceRecorderProps {
  onTranscription: (text: string) => void;
  onError?: (error: string) => void;
}

export function VoiceRecorder({ onTranscription, onError }: VoiceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<NodeJS.Timeout>();

  const startRecording = async () => {
    try {
      console.log('Starting recording process...');
      setError(null);
      const mediaRecorder = await voiceService.startRecording();
      console.log('Got MediaRecorder instance');

      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);
      
      // Start duration timer
      console.log('Starting duration timer');
      timerRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error('Failed to start recording:', {
        error: err,
        message: errorMessage,
        name: err instanceof Error ? err.name : 'Unknown'
      });
      setError('Failed to start recording. Please check your microphone permissions.');
      onError?.('Failed to start recording');
    }
  };

  const stopRecording = async () => {
    if (!mediaRecorderRef.current) {
      console.warn('No MediaRecorder instance found');
      return;
    }

    try {
      console.log('Starting stop recording process...');
      setIsProcessing(true);
      clearInterval(timerRef.current);
      setRecordingDuration(0);

      console.log('Stopping MediaRecorder...');
      const audioBlob = await voiceService.stopRecording(mediaRecorderRef.current);
      console.log('Got audio blob:', {
        size: audioBlob.size,
        type: audioBlob.type
      });

      console.log('Starting transcription...');
      const transcription = await voiceService.transcribeAudio(audioBlob);
      console.log('Got transcription:', transcription);
      
      onTranscription(transcription);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error('Failed to process recording:', {
        error: err,
        message: errorMessage,
        name: err instanceof Error ? err.name : 'Unknown',
        stack: err instanceof Error ? err.stack : undefined
      });
      setError('Failed to process recording');
      onError?.('Failed to process recording');
    } finally {
      console.log('Cleaning up recording state...');
      setIsRecording(false);
      setIsProcessing(false);
      mediaRecorderRef.current = null;
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex items-center gap-3">
      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 px-3 py-1.5 rounded-lg">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}
      
      {isRecording ? (
        <button
          onClick={stopRecording}
          disabled={isProcessing}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
            "bg-red-100 text-red-700 hover:bg-red-200",
            "disabled:opacity-50 disabled:cursor-not-allowed"
          )}
        >
          <div className="relative">
            <Square className="w-4 h-4" />
            <div className="absolute inset-0 animate-ping rounded-full bg-red-400/30" />
          </div>
          {formatDuration(recordingDuration)}
        </button>
      ) : (
        <button
          onClick={startRecording}
          disabled={isProcessing}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
            isProcessing
              ? "bg-indigo-100 text-indigo-700"
              : "bg-gray-100 text-gray-700 hover:bg-gray-200",
            "disabled:opacity-50 disabled:cursor-not-allowed"
          )}
        >
          {isProcessing ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <Mic className="w-4 h-4" />
              Record Voice
            </>
          )}
        </button>
      )}
    </div>
  );
}