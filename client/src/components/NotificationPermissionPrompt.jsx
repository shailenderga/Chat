import React, { useState, useEffect } from 'react';
import { Bell, BellRing, X, Check, Smartphone } from 'lucide-react';
import { getNotificationPermission, requestNotificationPermission } from '../utils/notifications';

export default function NotificationPermissionPrompt() {
  const [showPrompt, setShowPrompt] = useState(false);
  const [isRequesting, setIsRequesting] = useState(false);

  useEffect(() => {
    // Check if notifications are supported and in 'default' state
    const permission = getNotificationPermission();
    const hasDismissed = sessionStorage.getItem('wavy_notif_prompt_dismissed');

    if (permission === 'default' && !hasDismissed) {
      // Delay 1.5s for smooth entrance after page load
      const timer = setTimeout(() => {
        setShowPrompt(true);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleEnable = async () => {
    setIsRequesting(true);
    const result = await requestNotificationPermission();
    setIsRequesting(false);
    setShowPrompt(false);
  };

  const handleDismiss = () => {
    sessionStorage.setItem('wavy_notif_prompt_dismissed', 'true');
    setShowPrompt(false);
  };

  if (!showPrompt) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-dark-900 border border-brand-500/40 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 relative overflow-hidden">
        {/* Decorative Background Glow */}
        <div className="absolute -top-16 -right-16 w-36 h-36 bg-brand-500/20 rounded-full blur-3xl pointer-events-none" />

        {/* Close button */}
        <button
          onClick={handleDismiss}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-xl hover:bg-slate-800 transition"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header with animated icon */}
        <div className="flex items-start space-x-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-brand-600 to-indigo-500 flex items-center justify-center text-white shadow-lg shadow-brand-500/30 flex-shrink-0 animate-bounce">
            <BellRing className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-bold text-white flex items-center space-x-1.5">
              <span>Enable Notifications</span>
              <Smartphone className="w-4 h-4 text-brand-400 ml-1 inline" />
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Get instant alerts directly on your device & phone
            </p>
          </div>
        </div>

        {/* Benefits List */}
        <div className="space-y-2 py-1 bg-dark-950/60 rounded-2xl p-3.5 border border-slate-800/80 text-xs text-slate-300">
          <div className="flex items-center space-x-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span>Direct alerts when someone sends you a message</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span>Instant phone ring on incoming audio & video calls</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span>Snapchat streak expiration warnings (24h timer)</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span>Works even when your screen is locked or tab is closed</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-2 pt-1">
          <button
            type="button"
            onClick={handleEnable}
            disabled={isRequesting}
            className="w-full sm:flex-1 py-3 px-4 bg-brand-600 hover:bg-brand-500 text-white font-semibold text-xs sm:text-sm rounded-2xl transition shadow-lg shadow-brand-600/30 flex items-center justify-center space-x-2 disabled:opacity-50"
          >
            <Bell className="w-4 h-4" />
            <span>{isRequesting ? 'Requesting...' : 'Turn On Notifications'}</span>
          </button>

          <button
            type="button"
            onClick={handleDismiss}
            className="w-full sm:w-auto py-3 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-medium text-xs sm:text-sm rounded-2xl transition border border-slate-700/80"
          >
            Later
          </button>
        </div>
      </div>
    </div>
  );
}
