import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: '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',
  dangerouslyAllowBrowser: true
});

export const voiceService = {
  async startRecording(): Promise<MediaRecorder> {
    console.log('Starting voice recording...');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      console.log('Got audio stream:', stream);

      const mediaRecorder = new MediaRecorder(stream);
      console.log('Created MediaRecorder:', mediaRecorder);

      const audioChunks: Blob[] = [];

      mediaRecorder.ondataavailable = (event) => {
        console.log('Audio data available:', event.data.size, 'bytes');
        audioChunks.push(event.data);
      };

      mediaRecorder.onstart = () => {
        console.log('MediaRecorder started');
      };

      mediaRecorder.onerror = (event) => {
        console.error('MediaRecorder error:', event);
      };

      mediaRecorder.start();
      return mediaRecorder;
    } catch (err) {
      console.error('Failed to start recording:', {
        error: err,
        message: err instanceof Error ? err.message : 'Unknown error',
        name: err instanceof Error ? err.name : 'Unknown',
      });
      throw err;
    }
  },

  async stopRecording(mediaRecorder: MediaRecorder): Promise<Blob> {
    console.log('Stopping voice recording...');
    return new Promise((resolve) => {
      const audioChunks: Blob[] = [];
      
      mediaRecorder.ondataavailable = (event) => {
        console.log('Final audio chunk available:', event.data.size, 'bytes');
        audioChunks.push(event.data);
      };

      mediaRecorder.onstop = () => {
        console.log('MediaRecorder stopped');
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        console.log('Created audio blob:', {
          size: audioBlob.size,
          type: audioBlob.type
        });
        resolve(audioBlob);
      };

      mediaRecorder.stop();
      console.log('Stopping media tracks...');
      mediaRecorder.stream.getTracks().forEach(track => track.stop());
    });
  },

  async transcribeAudio(audioBlob: Blob): Promise<string> {
    console.log('Starting audio transcription...', {
      blobSize: audioBlob.size,
      blobType: audioBlob.type
    });
    try {
      // Convert blob to file
      const file = new File([audioBlob], 'recording.webm', { type: 'audio/webm' });
      console.log('Created audio file:', {
        name: file.name,
        size: file.size,
        type: file.type
      });

      // Send to Whisper API
      console.log('Sending to Whisper API...');
      const transcription = await openai.audio.transcriptions.create({
        file,
        model: 'whisper-1',
      });

      console.log('Got transcription:', transcription);
      return transcription.text;
    } catch (err) {
      console.error('Failed to transcribe audio:', {
        error: err,
        message: err instanceof Error ? err.message : 'Unknown error',
        name: err instanceof Error ? err.name : 'Unknown',
        stack: err instanceof Error ? err.stack : undefined
      });
      throw new Error('Failed to transcribe audio');
    }
  }
};