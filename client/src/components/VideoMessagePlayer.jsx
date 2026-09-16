import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Volume2, VolumeX, Download, Trash2, Maximize2 } from 'lucide-react';

export default function VideoMessagePlayer({
  fileUrl,
  fileName = 'video.mp4',
  onDelete,
  isOutgoing
}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showControls, setShowControls] = useState(true);

  const videoRef = useRef(null);
  const controlsTimeoutRef = useRef(null);

  useEffect(() => {
    return () => {
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    };
  }, []);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current.play().then(() => {
        setIsPlaying(true);
      }).catch(err => {
        console.error('Video play error:', err);
        setIsPlaying(false);
      });
    }
  };

  const toggleMute = (e) => {
    e.stopPropagation();
    if (!videoRef.current) return;
    videoRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current && isFinite(videoRef.current.duration)) {
      setDuration(videoRef.current.duration);
    }
  };

  const handleSeek = (e) => {
    e.stopPropagation();
    if (!videoRef.current || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const seekPercentage = Math.max(0, Math.min(1, clickX / rect.width));
    const seekTime = seekPercentage * duration;
    videoRef.current.currentTime = seekTime;
    setCurrentTime(seekTime);
  };

  const handleFullscreen = (e) => {
    e.stopPropagation();
    if (!videoRef.current) return;
    if (videoRef.current.requestFullscreen) {
      videoRef.current.requestFullscreen();
    } else if (videoRef.current.webkitRequestFullscreen) {
      videoRef.current.webkitRequestFullscreen();
    }
  };

  const handleDownload = (e) => {
    e.stopPropagation();
    const a = document.createElement('a');
    a.href = fileUrl;
    a.download = fileName || 'video.mp4';
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const formatTime = (secs) => {
    if (!secs || isNaN(secs) || !isFinite(secs) || secs < 0) return '00:00';
    const total = Math.floor(secs);
    const m = Math.floor(total / 60).toString().padStart(2, '0');
    const s = (total % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      className="relative rounded-2xl overflow-hidden bg-black/90 shadow-xl group max-w-sm sm:max-w-md w-full"
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => isPlaying && setShowControls(false)}
      onClick={togglePlay}
    >
      <video
        ref={videoRef}
        src={fileUrl}
        playsInline
        muted={isMuted}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={() => {
          setIsPlaying(false);
          setCurrentTime(0);
        }}
        className="w-full max-h-80 object-contain rounded-2xl bg-black cursor-pointer"
      />

      {/* Center Play Button Overlay (when paused) */}
      {!isPlaying && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/30 backdrop-blur-[2px] transition pointer-events-none">
          <div className="w-14 h-14 rounded-full bg-brand-600/90 text-white flex items-center justify-center shadow-2xl transform scale-100 group-hover:scale-110 transition">
            <Play className="w-6 h-6 fill-current ml-1" />
          </div>
        </div>
      )}

      {/* Top Floating Actions: Download & Delete */}
      <div
        className={`absolute top-2.5 right-2.5 flex items-center space-x-1.5 transition-opacity duration-200 z-10 ${
          showControls ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Download Button */}
        <button
          type="button"
          onClick={handleDownload}
          className="p-2 rounded-xl bg-black/60 hover:bg-black/90 text-slate-200 hover:text-white transition shadow backdrop-blur-sm border border-white/10"
          title="Download Video"
        >
          <Download className="w-4 h-4" />
        </button>

        {/* Delete Button */}
        {onDelete && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="p-2 rounded-xl bg-black/60 hover:bg-red-600 text-slate-200 hover:text-white transition shadow backdrop-blur-sm border border-white/10"
            title="Delete Video"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Bottom Floating Control Bar */}
      <div
        className={`absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-3 pt-6 flex flex-col space-y-1.5 transition-opacity duration-200 z-10 ${
          showControls || !isPlaying ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Seekable Progress Bar */}
        <div
          onClick={handleSeek}
          className="w-full h-1.5 bg-white/20 hover:h-2 rounded-full cursor-pointer relative overflow-hidden transition-all"
        >
          <div
            className="h-full bg-brand-500 rounded-full relative"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Control Buttons & Timers */}
        <div className="flex items-center justify-between text-xs text-white pt-0.5">
          <div className="flex items-center space-x-2.5">
            {/* Play/Pause Toggle */}
            <button
              type="button"
              onClick={togglePlay}
              className="text-white hover:text-brand-400 transition"
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
            </button>

            {/* Mute/Unmute Toggle */}
            <button
              type="button"
              onClick={toggleMute}
              className="text-white hover:text-brand-400 transition"
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4" />}
            </button>

            {/* Time Display */}
            <span className="text-[11px] font-mono text-slate-300">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>

          <div className="flex items-center space-x-2">
            {/* Fullscreen Button */}
            <button
              type="button"
              onClick={handleFullscreen}
              className="text-white hover:text-brand-400 transition"
              title="Fullscreen"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
