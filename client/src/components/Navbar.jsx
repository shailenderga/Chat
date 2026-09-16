import React, { useState, useEffect } from 'react';
import {
  MessageSquare, UserPlus, Bell, LogOut,
  Sparkles, Check, PhoneCall, ShieldAlert, Settings
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';

export default function Navbar({
  onGoHome,
  onOpenRequests,
  onOpenAdmin,
  onOpenSettings,
  onSelectConversationById,
  pendingRequestsCount = 0
}) {
  const { user, logout, token } = useAuth();
  const { socket } = useSocket();

  const [notifications, setNotifications] = useState([]);
  const [showNotifMenu, setShowNotifMenu] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    fetchNotifications();

    if (socket) {
      socket.on('incoming_notification', (newNotif) => {
        setNotifications(prev => [newNotif, ...prev]);
        setUnreadCount(c => c + 1);
      });
    }
  }, [socket]);

  const fetchNotifications = async () => {
    try {
      const res = await fetch('/api/notifications', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setNotifications(data || []);
        setUnreadCount((data || []).filter(n => !n.is_read).length);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const markRead = async () => {
    try {
      await fetch('/api/notifications/mark-read', {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` }
      });
      setUnreadCount(0);
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <nav className="h-16 px-3 sm:px-6 bg-dark-900/90 border-b border-slate-800 flex items-center justify-between backdrop-blur-xl select-none z-30 relative">
      {/* Brand (Click to return Home) */}
      <div
        onClick={onGoHome}
        className="flex items-center space-x-2.5 sm:space-x-3 cursor-pointer hover:opacity-90 transition"
        title="Go to Home"
      >
        <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-gradient-to-tr from-brand-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-brand-500/20 flex-shrink-0">
          <MessageSquare className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
        </div>
        <span className="font-bold text-white text-base sm:text-lg tracking-tight">Wavy</span>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center space-x-1.5 sm:space-x-2.5">

        {/* Friend Requests Button */}
        <button
          onClick={onOpenRequests}
          className="relative p-2 sm:p-2.5 rounded-xl sm:rounded-2xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition border border-slate-700"
          title="Friend Requests & Search"
        >
          <UserPlus className="w-4 h-4" />
          {pendingRequestsCount > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-brand-600 text-white text-[9px] sm:text-[10px] font-bold flex items-center justify-center border-2 border-dark-900 animate-pulse">
              {pendingRequestsCount}
            </span>
          )}
        </button>

        {/* Real-time Notification Bell */}
        <div className="relative">
          <button
            onClick={() => {
              setShowNotifMenu(!showNotifMenu);
              if (!showNotifMenu && unreadCount > 0) {
                markRead();
              }
            }}
            className="relative p-2 sm:p-2.5 rounded-xl sm:rounded-2xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition border border-slate-700"
            title="Notifications"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-red-500 text-white text-[9px] sm:text-[10px] font-bold flex items-center justify-center border-2 border-dark-900 animate-bounce">
                {unreadCount}
              </span>
            )}
          </button>

          {/* Notification Dropdown Menu */}
          {showNotifMenu && (
            <div className="fixed sm:absolute top-16 sm:top-auto sm:right-0 right-2 left-2 sm:left-auto mt-1 sm:mt-3 sm:w-80 bg-dark-900 border border-slate-700/80 rounded-2xl sm:rounded-3xl shadow-2xl p-4 z-50 animate-slide-up">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-3">
                <span className="text-xs font-bold text-white uppercase tracking-wider">Notifications</span>
                <span className="text-[10px] text-brand-400 cursor-pointer" onClick={markRead}>Mark all read</span>
              </div>
              <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
                {notifications.length === 0 ? (
                  <div className="text-center py-6 text-xs text-slate-500">No new notifications</div>
                ) : (
                  notifications.map((n, i) => (
                    <div
                      key={i}
                      onClick={() => {
                        const convoId = n.conversationId || n.metadata?.conversationId;
                        if (convoId && onSelectConversationById) {
                          onSelectConversationById(convoId);
                        } else if (n.type === 'request' && onOpenRequests) {
                          onOpenRequests();
                        }
                        setShowNotifMenu(false);
                      }}
                      className={`p-2.5 rounded-2xl border text-xs transition cursor-pointer hover:border-brand-500/60 ${n.is_read ? 'bg-dark-950/40 border-slate-800 text-slate-400' : 'bg-dark-950 border-brand-500/30 text-slate-200'}`}
                    >
                      <div className="font-semibold text-white flex items-center justify-between">
                        <span>{n.title}</span>
                        <span className="text-[10px] text-brand-400 font-normal">Tap to open</span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">{n.content}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Super Admin Dashboard Button (Only for role === 'admin') */}
        {user?.role === 'admin' && (
          <button
            onClick={onOpenAdmin}
            className="px-3.5 py-2 rounded-2xl bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/40 text-xs font-bold transition flex items-center space-x-1.5 animate-pulse"
            title="Super Admin Portal"
          >
            <ShieldAlert className="w-4 h-4" />
            <span className="hidden sm:inline">Admin Monitor</span>
          </button>
        )}

        {/* Settings Button */}
        <button
          onClick={onOpenSettings}
          className="p-2 sm:p-2.5 rounded-xl sm:rounded-2xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition border border-slate-700"
          title="Settings & Profile"
        >
          <Settings className="w-4 h-4" />
        </button>

        {/* User Avatar & Logout */}
        <div className="flex items-center space-x-3 pl-2 border-l border-slate-800">
          <button
            onClick={onOpenSettings}
            className="flex items-center space-x-2 text-left hover:opacity-80 transition cursor-pointer"
            title="Open Settings"
          >
            <img
              src={user?.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${user?.username || 'user'}`}
              alt={user?.name}
              className="w-9 h-9 rounded-xl object-cover bg-slate-800 border border-slate-700"
            />
            <div className="hidden md:block text-left">
              <div className="text-xs font-semibold text-white truncate max-w-[100px]">{user?.name}</div>
              <div className="text-[10px] text-brand-400 font-mono">@{user?.username}</div>
            </div>
          </button>

          <button
            onClick={logout}
            className="p-2 text-slate-400 hover:text-red-400 rounded-xl hover:bg-slate-800 transition"
            title="Sign Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </nav>
  );
}
