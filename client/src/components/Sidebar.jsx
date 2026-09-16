import React, { useState } from 'react';
import { Search, Flame, Clock, Phone, Video, ShieldCheck, UserPlus, Check, CheckCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import StoryTray from './StoryTray';

export default function Sidebar({
  conversations = [],
  activeConversation,
  onSelectConversation,
  onOpenRequests,
  onInspectUser
}) {
  const { user } = useAuth();
  const { onlineUsers, typingUsers } = useSocket();
  const [search, setSearch] = useState('');

  const filtered = conversations.filter(c =>
    c.partner?.name?.toLowerCase().includes(search.toLowerCase()) ||
    c.partner?.username?.toLowerCase().includes(search.toLowerCase())
  );

  const formatLastTime = (timeStr) => {
    if (!timeStr) return '';
    const date = new Date(timeStr);
    const now = new Date();
    if (date.toDateString() === now.toDateString()) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  return (
    <aside className="w-full bg-dark-900 border-r border-slate-800 flex flex-col h-full select-none">
      {/* 24-Hour Stories Section */}
      <div className="p-3 border-b border-slate-800/80 bg-dark-950/40">
        <StoryTray />
      </div>

      {/* Search Conversations */}
      <div className="p-3 border-b border-slate-800/80">
        <div className="relative">
          <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search chats & friends..."
            className="w-full bg-dark-950 border border-slate-800 rounded-2xl pl-10 pr-4 py-2.5 text-xs text-white focus:outline-none focus:border-brand-500 transition"
          />
        </div>
      </div>

      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-800/40">
        {filtered.length === 0 ? (
          <div className="text-center py-16 px-6 text-slate-500">
            <div className="w-12 h-12 rounded-2xl bg-slate-800/60 border border-slate-700/50 flex items-center justify-center mx-auto mb-3 text-slate-400">
              <UserPlus className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-semibold text-slate-300 mb-1">No Active Chats</h4>
            <p className="text-xs text-slate-400 mb-4">
              To chat, send a friend request to any user. Once accepted, your private chat will unlock!
            </p>
            <button
              onClick={onOpenRequests}
              className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-xs font-semibold transition shadow-md shadow-brand-600/20"
            >
              Find Friends by @Username
            </button>
          </div>
        ) : (
          filtered.map((convo) => {
            const partner = convo.partner || {};
            const isOnline = onlineUsers.has(partner.id) || partner.status === 'online';
            const isTyping = Boolean(typingUsers[convo.id] && typingUsers[convo.id].userId === partner.id);
            const isSelected = activeConversation?.id === convo.id;

            return (
              <div
                key={convo.id}
                onClick={() => onSelectConversation(convo)}
                className={`p-3.5 flex items-center space-x-3 cursor-pointer transition relative ${
                  isSelected ? 'bg-brand-600/10 border-l-4 border-l-brand-500' : 'hover:bg-slate-800/40'
                }`}
              >
                {/* Avatar with Online indicator */}
                <div
                  className="relative flex-shrink-0 cursor-pointer group/avatar"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onInspectUser) onInspectUser(partner);
                  }}
                  title="Click to view full profile & bio"
                >
                  <img
                    src={partner.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${partner.username}`}
                    alt={partner.name}
                    className="w-12 h-12 rounded-2xl bg-slate-800 object-cover border border-slate-700 group-hover/avatar:ring-2 group-hover/avatar:ring-brand-500/60 transition-all"
                  />
                  {isOnline && (
                    <span className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-dark-900 shadow-sm" />
                  )}
                </div>

                {/* Conversation Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="text-xs sm:text-sm font-semibold text-white truncate">{partner.name}</h4>
                    <span className="text-[10px] text-slate-400 font-mono flex-shrink-0">
                      {formatLastTime(convo.lastMessageTime)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    {isTyping ? (
                      <p className="text-xs text-emerald-400 font-semibold italic flex items-center space-x-1 animate-pulse truncate pr-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping mr-1 inline-block" />
                        <span>typing...</span>
                      </p>
                    ) : (
                      <div className="flex items-center space-x-1 truncate pr-2">
                        {convo.lastMessage && convo.lastMessage.sender_id === user?.id && (
                          <span className="flex-shrink-0" title={convo.lastMessage.status === 'read' ? 'Read' : convo.lastMessage.status === 'delivered' ? 'Delivered' : 'Sent'}>
                            {convo.lastMessage.status === 'read' ? (
                              <CheckCheck className="w-3.5 h-3.5 text-sky-400 stroke-[2.5]" />
                            ) : convo.lastMessage.status === 'delivered' ? (
                              <CheckCheck className="w-3.5 h-3.5 text-slate-400 stroke-[2]" />
                            ) : (
                              <Check className="w-3.5 h-3.5 text-slate-500 stroke-[2]" />
                            )}
                          </span>
                        )}
                        <p className="text-xs text-slate-400 truncate">
                          {convo.lastMessage?.message_type === 'voice_note' ? '🎤 Voice note' :
                           convo.lastMessage?.message_type === 'image' ? '📷 Photo' :
                           convo.lastMessage?.message_type === 'video' ? '🎥 Video' :
                           convo.lastMessage?.message_type === 'meeting_invite' ? '📹 Video Meeting' :
                           convo.lastMessage?.content || `@${partner.username}`}
                        </p>
                      </div>
                    )}

                    {/* Snapchat Streak Badge */}
                    <div className="flex items-center space-x-1.5 flex-shrink-0">
                      {convo.streakCount > 0 && (
                        <div
                          className={`px-2 py-0.5 rounded-full text-[11px] font-bold flex items-center space-x-1 shadow-sm ${
                            convo.isExpiringSoon
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse'
                              : 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                          }`}
                          title={
                            convo.isExpiringSoon
                              ? `⚠️ Streak expiring in ${convo.hoursRemaining} hours! Send a message to keep it alive.`
                              : `Active Streak: ${convo.streakCount} consecutive days`
                          }
                        >
                          <Flame className="w-3.5 h-3.5 fill-current" />
                          <span>{convo.streakCount}d</span>
                          {convo.isExpiringSoon && (
                            <Clock className="w-3 h-3 text-amber-300 ml-0.5" />
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
}
