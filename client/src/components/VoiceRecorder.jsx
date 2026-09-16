import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, Trash2, Send, Play, Pause, RotateCcw } from 'lucide-react';

export default function VoiceRecorder({ onSendVoiceNote, onCancel }) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackTime, setPlaybackTime] = useState(0);

  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);
  const audioPlayerRef = useRef(null);

  // Start recording immediately on mount
  useEffect(() => {
    startRecording();
    return () => {
      stopRecordingCleanup();
    };
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      let options = {};
      if (typeof MediaRecorder.isTypeSupported === 'function') {
        if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
          options = { mimeType: 'audio/webm;codecs=opus' };
        } else if (MediaRecorder.isTypeSupported('audio/webm')) {
          options = { mimeType: 'audio/webm' };
        } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
          options = { mimeType: 'audio/mp4' };
        }
      }

      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.start(100);
      setIsRecording(true);
      setRecordingTime(0);

      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Error accessing microphone:', err);
      alert('Could not access microphone. Please ensure microphone permissions are granted.');
      onCancel();
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.onstop = () => {
        const mime = mediaRecorderRef.current?.mimeType || 'audio/webm';
        const blob = new Blob(audioChunksRef.current, { type: mime });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((t) => t.stop());
        }
      };
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      clearInterval(timerRef.current);
    }
  };

  const stopAndSend = () => {
    if (mediaRecorderRef.current && isRecording) {
      const finalTime = Math.max(1, recordingTime);
      mediaRecorderRef.current.onstop = () => {
        const mime = mediaRecorderRef.current?.mimeType || 'audio/webm';
        const blob = new Blob(audioChunksRef.current, { type: mime });
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((t) => t.stop());
        }
        onSendVoiceNote(blob, finalTime);
      };
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      clearInterval(timerRef.current);
    }
  };

  const stopRecordingCleanup = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch (e) {}
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
    }
    clearInterval(timerRef.current);
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
  };

  const handleSend = () => {
    if (audioBlob) {
      onSendVoiceNote(audioBlob, recordingTime);
    }
  };

  const togglePlayback = () => {
    if (!audioPlayerRef.current) return;
    if (isPlaying) {
      audioPlayerRef.current.pause();
      setIsPlaying(false);
    } else {
      audioPlayerRef.current.play();
      setIsPlaying(true);
    }
  };

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  return (
    <div className="flex items-center space-x-3 bg-dark-900 border border-brand-500/30 px-4 py-2.5 rounded-2xl w-full animate-slide-up shadow-xl">
      {/* Discard button */}
      <button
        onClick={() => {
          stopRecordingCleanup();
          onCancel();
        }}
        className="p-2 text-red-400 hover:bg-red-500/10 rounded-xl transition"
        title="Discard Recording"
      >
        <Trash2 className="w-5 h-5" />
      </button>

      {/* Recording in progress */}
      {isRecording ? (
        <>
          <div className="flex items-center space-x-2">
            <span className="w-3 h-3 rounded-full bg-red-500 animate-ping" />
            <span className="text-xs font-mono font-bold text-red-400">{formatTime(recordingTime)}</span>
          </div>

          {/* Animated sound wave bars */}
          <div className="flex-1 flex items-center justify-center space-x-1 h-6 px-4">
            {[40, 70, 30, 90, 60, 100, 45, 80, 50, 95, 35, 85, 60, 40, 75, 90].map((h, i) => (
              <div
                key={i}
                className="w-1 bg-brand-500 rounded-full animate-pulse"
                style={{
                  height: `${h}%`,
                  animationDelay: `${(i % 5) * 0.15}s`
                }}
              />
            ))}
          </div>

          <div className="flex items-center space-x-1.5">
            <button
              type="button"
              onClick={stopRecording}
              className="p-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl transition"
              title="Preview Recording"
            >
              <Square className="w-4 h-4 fill-current" />
            </button>
            <button
              type="button"
              onClick={stopAndSend}
              className="p-2 bg-brand-600 hover:bg-brand-500 text-white rounded-xl transition shadow-md shadow-brand-600/30"
              title="Send Voice Note"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </>
      ) : (
        /* Preview recorded audio */
        <>
          <button
            onClick={togglePlayback}
            className="p-2 bg-brand-600 hover:bg-brand-500 text-white rounded-xl transition shadow-md"
          >
            {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
          </button>

          <div className="flex-1 px-2">
            <div className="flex items-center justify-between text-xs text-slate-400 font-mono mb-1">
              <span>Voice Note Preview</span>
              <span>{formatTime(recordingTime)}</span>
            </div>
            <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-brand-500 h-full rounded-full transition-all duration-100"
                style={{
                  width: `${audioPlayerRef.current ? (playbackTime / recordingTime) * 100 : 0}%`
                }}
              />
            </div>
            {audioUrl && (
              <audio
                ref={audioPlayerRef}
                src={audioUrl}
                onTimeUpdate={() => setPlaybackTime(audioPlayerRef.current?.currentTime || 0)}
                onEnded={() => {
                  setIsPlaying(false);
                  setPlaybackTime(0);
                }}
                className="hidden"
              />
            )}
          </div>

          <button
            onClick={handleSend}
            className="p-2.5 bg-brand-600 hover:bg-brand-500 text-white rounded-xl transition shadow-lg shadow-brand-600/30 flex items-center space-x-1 font-medium text-xs"
          >
            <Send className="w-4 h-4" />
            <span>Send</span>
          </button>
        </>
      )}
    </div>
  );
}
