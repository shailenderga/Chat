import React, { useState, useEffect } from 'react';
import { ShieldAlert, EyeOff, Lock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function SecurityShield({ children }) {
  const { user } = useAuth();
  const [isBlurred, setIsBlurred] = useState(false);
  const [screenshotAttempted, setScreenshotAttempted] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString());

  // Clock for dynamic watermark
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    // 1. Blur detection (when Snipping Tool, Win+Shift+S, or tab switch is triggered)
    const handleBlur = () => {
      setIsBlurred(true);
    };

    const handleFocus = () => {
      setIsBlurred(false);
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        setIsBlurred(true);
      } else {
        setIsBlurred(false);
      }
    };

    // 2. Keyboard shortcut blocking & clipboard purge
    const handleKeyDown = (e) => {
      // PrintScreen Key
      if (e.key === 'PrintScreen' || e.keyCode === 44) {
        e.preventDefault();
        setScreenshotAttempted(true);
        setIsBlurred(true);
        // Wipe clipboard
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText('Screenshots are prohibited on Wavy for user privacy.');
        }
        setTimeout(() => setScreenshotAttempted(false), 3500);
      }

      // Ctrl+S, Ctrl+P, Ctrl+Shift+I, F12
      if (
        (e.ctrlKey && (e.key === 's' || e.key === 'S')) ||
        (e.ctrlKey && (e.key === 'p' || e.key === 'P')) ||
        (e.ctrlKey && e.shiftKey && (e.key === 'i' || e.key === 'I')) ||
        e.key === 'F12'
      ) {
        e.preventDefault();
        setIsBlurred(true);
        setTimeout(() => setIsBlurred(false), 1500);
      }
    };

    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  return (
    <div 
      className="relative w-full h-full select-none"
      onContextMenu={(e) => e.preventDefault()}
      onDragStart={(e) => e.preventDefault()}
    >
      {/* Dynamic Traceable Security Watermark */}
      {user && (
        <div 
          className="pointer-events-none absolute inset-0 z-20 flex flex-wrap items-center justify-around opacity-[0.04] overflow-hidden select-none p-4"
          aria-hidden="true"
        >
          {Array.from({ length: 32 }).map((_, idx) => (
            <div key={idx} className="transform -rotate-12 m-8 text-xs font-mono font-bold tracking-wider text-slate-300">
              @{user.username} • UID:{user.id} • {currentTime}
            </div>
          ))}
        </div>
      )}

      {/* Main App Content */}
      <div className={`w-full h-full transition-all duration-200 ${isBlurred ? 'filter blur-2xl opacity-10 pointer-events-none' : ''}`}>
        {children}
      </div>

      {/* Screenshot Attempt Warning Banner */}
      {screenshotAttempted && (
        <div className="fixed top-6 left-1/2 transform -translate-x-1/2 z-50 bg-red-600/95 text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center space-x-3 border border-red-400 backdrop-blur animate-bounce">
          <ShieldAlert className="w-6 h-6 text-yellow-300" />
          <div>
            <div className="font-bold text-sm">Screenshot Blocked</div>
            <div className="text-xs text-red-100">Screenshots of chats & profiles are strictly protected for privacy.</div>
          </div>
        </div>
      )}

      {/* Focus Lost / Privacy Shield Blackout Overlay */}
      {isBlurred && (
        <div 
          onClick={() => setIsBlurred(false)}
          className="fixed inset-0 z-40 bg-dark-950/95 backdrop-blur-3xl flex flex-col items-center justify-center p-6 text-center cursor-pointer transition-all animate-fade-in"
        >
          <div className="w-20 h-20 rounded-3xl bg-brand-500/10 border border-brand-500/30 flex items-center justify-center mb-6 shadow-2xl">
            <Lock className="w-10 h-10 text-brand-500 animate-pulse" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2 flex items-center space-x-2">
            <span>Privacy Guard Active</span>
          </h2>
          <p className="text-slate-400 max-w-md text-sm mb-6 leading-relaxed">
            Content is hidden while the window is inactive or snipping tool is open to prevent unauthorized screenshots and recordings.
          </p>
          <div className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-sm font-medium transition shadow-lg shadow-brand-600/20">
            <EyeOff className="w-4 h-4" />
            <span>Click anywhere to resume</span>
          </div>
        </div>
      )}
    </div>
  );
}
