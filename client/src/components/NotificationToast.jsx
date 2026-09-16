import React from 'react';
import { MessageSquare, UserPlus, PhoneCall, Flame, X, Video } from 'lucide-react';
import { useSocket } from '../context/SocketContext';

export default function NotificationToast({ onSelectConversationById, onOpenRequests }) {
  const { activeToast, clearToast } = useSocket();

  if (!activeToast) return null;

  const handleClick = () => {
    const convoId = activeToast.conversationId || activeToast.metadata?.conversationId;
    if (convoId && onSelectConversationById) {
      onSelectConversationById(convoId);
      clearToast();
    } else if (activeToast.type === 'request' && onOpenRequests) {
      onOpenRequests();
      clearToast();
    }
  };

  const getIcon = () => {
    switch (activeToast.type) {
      case 'request':
        return <UserPlus className="w-5 h-5 text-indigo-400" />;
      case 'call_permission':
        return <PhoneCall className="w-5 h-5 text-emerald-400" />;
      case 'streak':
        return <Flame className="w-5 h-5 text-orange-400 animate-bounce" />;
      case 'meeting':
        return <Video className="w-5 h-5 text-purple-400" />;
      default:
        return <MessageSquare className="w-5 h-5 text-brand-500" />;
    }
  };

  return (
    <div
      onClick={handleClick}
      className="fixed bottom-6 right-4 sm:right-6 z-50 max-w-sm w-[calc(100%-2rem)] sm:w-full bg-dark-900/95 border border-brand-500/40 hover:border-brand-500 backdrop-blur-xl rounded-2xl shadow-2xl p-4 flex items-start space-x-3 animate-slide-up cursor-pointer transition hover:scale-[1.02]"
    >
      <div className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700/50 flex-shrink-0">
        {getIcon()}
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="text-sm font-semibold text-white truncate flex items-center justify-between">
          <span>{activeToast.title}</span>
          <span className="text-[10px] text-brand-400 font-normal">Tap to view</span>
        </h4>
        <p className="text-xs text-slate-300 mt-0.5 line-clamp-2">{activeToast.content}</p>
      </div>
      <button 
        onClick={(e) => {
          e.stopPropagation();
          clearToast();
        }}
        className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition flex-shrink-0"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
