import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Volume2, AlertCircle, RefreshCw } from 'lucide-react';

export default function AudioMessagePlayer({ fileUrl, duration = 0, isOutgoing }) {
  const numDuration = Number(duration) > 0 ? Number(duration) : 0;
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(numDuration);
  const [hasError, setHasError] = useState(false);
  const audioRef = useRef(null);

  // Sync duration prop if provided
  useEffect(() => {
    if (numDuration > 0 && (!audioDuration || !isFinite(audioDuration) || audioDuration === 0)) {
      setAudioDuration(numDuration);
    }
  }, [numDuration]);

  const togglePlay = () => {
    if (!audioRef.current) return;

    if (hasError) {
      setHasError(false);
      audioRef.current.load();
    }

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      setHasError(false);
      const playPromise = audioRef.current.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            setIsPlaying(true);
            setHasError(false);
          })
          .catch((err) => {
            if (err.name !== 'AbortError') {
              console.warn('Audio play error:', err);
              setIsPlaying(false);
              setHasError(true);
            }
          });
      }
    }
  };

  const handleRetry = (e) => {
    e.stopPropagation();
    setHasError(false);
    if (audioRef.current) {
      audioRef.current.load();
      audioRef.current
        .play()
        .then(() => {
          setIsPlaying(true);
          setHasError(false);
        })
        .catch((err) => {
          if (err.name !== 'AbortError') {
            setHasError(true);
          }
        });
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      const cur = audioRef.current.currentTime;
      setCurrentTime(cur);

      // Dynamically expand duration if audio is longer than expected
      if (!isFinite(audioDuration) || audioDuration <= 0) {
        if (isFinite(audioRef.current.duration) && audioRef.current.duration > 0) {
          setAudioDuration(audioRef.current.duration);
        } else if (numDuration > 0) {
          setAudioDuration(numDuration);
        } else if (cur > audioDuration) {
          setAudioDuration(Math.ceil(cur));
        }
      } else if (cur > audioDuration) {
        setAudioDuration(Math.ceil(cur));
      }
    }
  };

  const handleLoadedMetadata = () => {
    if (!audioRef.current) return;
    const d = audioRef.current.duration;
    if (isFinite(d) && d > 0) {
      setAudioDuration(d);
    } else if (numDuration > 0) {
      setAudioDuration(numDuration);
    }
  };

  const effectiveDuration =
    isFinite(audioDuration) && audioDuration > 0
      ? audioDuration
      : numDuration > 0
      ? numDuration
      : Math.max(currentTime, 1);

  const handleSeek = (e) => {
    e.stopPropagation();
    if (!audioRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, clickX / rect.width));
    const targetTime = ratio * effectiveDuration;
    audioRef.current.currentTime = targetTime;
    setCurrentTime(targetTime);
  };

  const formatTime = (secs) => {
    if (!secs || isNaN(secs) || !isFinite(secs) || secs < 0) return '00:00';
    const total = Math.floor(secs);
    const m = Math.floor(total / 60).toString().padStart(2, '0');
    const s = (total % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  // 24 waveform bar heights
  const waveBars = [
    30, 50, 75, 40, 85, 60, 95, 45,
    70, 85, 55, 90, 65, 40, 80, 50,
    95, 70, 45, 60, 75, 55, 40, 30
  ];

  const progressRatio = effectiveDuration > 0 ? Math.min(1, Math.max(0, currentTime / effectiveDuration)) : 0;

  return (
    <div className="flex items-center space-x-3 py-1 px-1 min-w-[240px] max-w-[300px]">
      <button
        type="button"
        onClick={togglePlay}
        className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition shadow-md ${
          isOutgoing
            ? 'bg-white text-brand-600 hover:bg-slate-100'
            : 'bg-brand-600 text-white hover:bg-brand-500'
        }`}
        title={isPlaying ? 'Pause voice note' : 'Play voice note'}
      >
        {isPlaying ? (
          <Pause className="w-4 h-4 fill-current" />
        ) : (
          <Play className="w-4 h-4 fill-current ml-0.5" />
        )}
      </button>

      <div className="flex-1 min-w-0">
        {/* Clickable Waveform Progress Bar */}
        <div
          onClick={handleSeek}
          className="flex items-center space-x-1 h-7 cursor-pointer py-1 group select-none"
          title="Click to seek"
        >
          {waveBars.map((height, i) => {
            const barRatio = i / (waveBars.length - 1);
            const isFilled = barRatio <= progressRatio;

            return (
              <div
                key={i}
                className={`flex-1 rounded-full transition-all duration-100 ${
                  isFilled
                    ? isOutgoing
                      ? 'bg-white shadow-[0_0_6px_rgba(255,255,255,0.4)]'
                      : 'bg-brand-400 shadow-[0_0_6px_rgba(99,102,241,0.5)]'
                    : isOutgoing
                    ? 'bg-white/30 group-hover:bg-white/50'
                    : 'bg-slate-700 group-hover:bg-slate-600'
                }`}
                style={{ height: `${height}%` }}
              />
            );
          })}
        </div>

        {/* Timestamps */}
        <div
          className={`flex items-center justify-between text-[10px] font-mono select-none ${
            isOutgoing ? 'text-indigo-100' : 'text-slate-400'
          }`}
        >
          <span>{formatTime(currentTime)}</span>
          {hasError ? (
            <button
              type="button"
              onClick={handleRetry}
              className="text-amber-300 hover:text-white flex items-center space-x-1 underline font-semibold transition"
              title="Click to retry audio"
            >
              <AlertCircle className="w-3 h-3" />
              <span>Retry</span>
            </button>
          ) : (
            <span>{formatTime(effectiveDuration)}</span>
          )}
        </div>
      </div>

      <audio
        ref={audioRef}
        src={fileUrl}
        preload="metadata"
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onError={() => {
          const err = audioRef.current?.error;
          if (err && err.code === 1) return; // Ignore abort
          console.warn('Audio load error:', err);
          setHasError(true);
          setIsPlaying(false);
        }}
        onEnded={() => {
          setIsPlaying(false);
          setCurrentTime(0);
        }}
        className="hidden"
      />
    </div>
  );
}

