import React, { useState, useEffect, useRef } from 'react';
import {
  Phone, Video, Lock, Paperclip, Send, Mic,
  Flame, Clock, Smile, Image as ImageIcon, Check, CheckCheck, Video as VideoIcon,
  AlertCircle, ArrowLeft, Trash2
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { playNotificationSound, playStreakSound } from '../utils/sound';
import AudioMessagePlayer from './AudioMessagePlayer';
import VideoMessagePlayer from './VideoMessagePlayer';
import VoiceRecorder from './VoiceRecorder';
import EmojiPicker from './EmojiPicker';
import UserProfileModal from './UserProfileModal';

const WALLPAPER_MAP = {
  default: 'bg-dark-950',
  navy: 'bg-gradient-to-b from-slate-950 via-indigo-950 to-slate-950',
  violet: 'bg-gradient-to-tr from-[#130722] via-[#1f1035] to-[#0d021a]',
  emerald: 'bg-gradient-to-b from-slate-950 via-emerald-950/40 to-slate-950',
  velvet: 'bg-gradient-to-br from-[#1a0a14] via-[#240c1a] to-[#0a0510]',
  cyber: 'bg-gradient-to-br from-indigo-950 via-slate-950 to-purple-950'
};

export default function ChatWindow({
  conversation,
  onBack,
  onOpenCallPermission,
  onStartOneOnOneCall,
  onOpenCreateMeeting,
  onStreakUpdated
}) {
  const { user, token } = useAuth();
  const { socket, onlineUsers, userLastSeen, typingUsers, emitTyping, emitStopTyping } = useSocket();

  const [messages, setMessages] = useState([]);
  const [textInput, setTextInput] = useState('');
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [hoveredMessageId, setHoveredMessageId] = useState(null);
  const [lightboxMedia, setLightboxMedia] = useState(null);
  const [deleteModalMsg, setDeleteModalMsg] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showPartnerProfile, setShowPartnerProfile] = useState(false);

  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const typingTimerRef = useRef(null);

  const partner = conversation?.partner || {};
  const isPartnerOnline = onlineUsers.has(partner.id) || partner.status === 'online';
  const partnerTypingData = typingUsers[conversation?.id];
  const isPartnerTyping = Boolean(partnerTypingData && partnerTypingData.userId === partner.id);

  const formatLastSeen = (timeStr) => {
    if (partner?.last_seen_privacy === 'nobody') return 'Offline';
    if (!timeStr) return 'Offline';
    const date = new Date(timeStr);
    if (isNaN(date.getTime())) return 'Offline';
    const now = new Date();
    const diffMin = Math.floor((now - date) / 60000);
    if (diffMin < 1) return 'Last seen just now';
    if (diffMin < 60) return `Last seen ${diffMin}m ago`;
    if (date.toDateString() === now.toDateString()) {
      return `Last seen today at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }
    return `Last seen ${date.toLocaleDateString([], { month: 'short', day: 'numeric' })} at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  };

  useEffect(() => {
    if (!conversation?.id) return;

    fetchMessages();
    markMessagesAsRead();

    // Join conversation room in Socket
    if (socket) {
      socket.emit('join_conversation', conversation.id);

      socket.on('new_message', ({ conversationId, message, streakCount }) => {
        if (conversationId === conversation.id) {
          setMessages((prev) => [...prev, message]);
          playNotificationSound();
          markMessagesAsRead();
          if (streakCount && onStreakUpdated) {
            onStreakUpdated(conversation.id, streakCount);
            playStreakSound();
          }
        }
      });

      socket.on('messages_read', ({ conversationId }) => {
        if (conversationId === conversation.id) {
          setMessages((prev) => prev.map((m) => (m.sender_id === user?.id ? { ...m, status: 'read' } : m)));
        }
      });

      socket.on('messages_delivered', ({ conversationId }) => {
        if (!conversationId || conversationId === conversation.id) {
          setMessages((prev) => prev.map((m) => (m.sender_id === user?.id && m.status === 'sent' ? { ...m, status: 'delivered' } : m)));
        }
      });

      socket.on('message_status_update', ({ messageId, conversationId, status }) => {
        if (conversationId === conversation.id) {
          setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, status } : m)));
        }
      });

      socket.on('message_deleted', ({ messageId, conversationId }) => {
        if (conversationId === conversation.id) {
          setMessages((prev) => prev.filter((m) => m.id !== messageId));
        }
      });
    }

    // Fallback polling for Serverless environments (Vercel) when socket is not active
    const pollInterval = setInterval(() => {
      if (!socket || !socket.connected) {
        fetchMessages();
      }
    }, 3000);

    return () => {
      clearInterval(pollInterval);
      if (socket) {
        socket.emit('leave_conversation', conversation.id);
        socket.off('new_message');
        socket.off('messages_read');
        socket.off('messages_delivered');
        socket.off('message_status_update');
        socket.off('message_deleted');
      }
      if (typingTimerRef.current) {
        clearTimeout(typingTimerRef.current);
      }
      emitStopTyping(conversation.id, partner.id);
    };
  }, [conversation?.id, socket, partner.id, emitStopTyping]);

  const markMessagesAsRead = async () => {
    if (!conversation?.id || !token) return;
    try {
      await fetch(`/api/chats/${conversation.id}/read`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (socket) {
        socket.emit('mark_read', { conversationId: conversation.id, userId: user?.id });
      }
    } catch (e) {
      console.warn('Mark read error:', e);
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isPartnerTyping]);

  const fetchMessages = async () => {
    try {
      const res = await fetch(`/api/chats/${conversation.id}/messages`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setMessages(data || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleInputChange = (e) => {
    const val = e.target.value;
    setTextInput(val);

    if (val.trim()) {
      emitTyping(conversation.id, partner.id);
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      typingTimerRef.current = setTimeout(() => {
        emitStopTyping(conversation.id, partner.id);
      }, 2500);
    } else {
      emitStopTyping(conversation.id, partner.id);
    }
  };

  const handleSendMessage = async (e) => {
    if (e) e.preventDefault();
    if (!textInput.trim() || !conversation?.id) return;

    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    emitStopTyping(conversation.id, partner.id);

    const content = textInput.trim();
    setTextInput('');

    try {
      const res = await fetch(`/api/chats/${conversation.id}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          messageType: 'text',
          content
        })
      });

      if (res.ok) {
        const data = await res.json();
        setMessages((prev) => [...prev, data.message]);

        // Emit via socket
        if (socket) {
          socket.emit('send_message', {
            conversationId: conversation.id,
            partnerId: partner.id,
            message: data.message,
            streakCount: data.streakCount
          });
        }

        if (data.streakCount && onStreakUpdated) {
          onStreakUpdated(conversation.id, data.streakCount);
          if (data.streakCount > (conversation.streakCount || 0)) {
            playStreakSound();
          }
        }
      }
    } catch (err) {
      console.error('Send message error:', err);
    }
  };

  const handleSendVoiceNote = async (blob, duration) => {
    setIsRecordingVoice(false);
    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', blob, 'voicenote.webm');

      const uploadRes = await fetch('/api/chats/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });

      if (uploadRes.ok) {
        const uploadData = await uploadRes.json();

        // Send voice note message
        const res = await fetch(`/api/chats/${conversation.id}/messages`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            messageType: 'voice_note',
            fileUrl: uploadData.fileUrl,
            duration
          })
        });

        if (res.ok) {
          const data = await res.json();
          setMessages((prev) => [...prev, data.message]);

          if (socket) {
            socket.emit('send_message', {
              conversationId: conversation.id,
              partnerId: partner.id,
              message: data.message,
              streakCount: data.streakCount
            });
          }

          if (data.streakCount && onStreakUpdated) {
            onStreakUpdated(conversation.id, data.streakCount);
          }
        }
      }
    } catch (e) {
      console.error('Voice note send error:', e);
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const uploadRes = await fetch('/api/chats/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });

      if (uploadRes.ok) {
        const uploadData = await uploadRes.json();
        let messageType = 'image';
        if (file.type.startsWith('video/')) messageType = 'video';
        else if (file.type.startsWith('audio/')) messageType = 'audio';

        const res = await fetch(`/api/chats/${conversation.id}/messages`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            messageType,
            fileUrl: uploadData.fileUrl,
            content: file.name
          })
        });

        if (res.ok) {
          const data = await res.json();
          setMessages((prev) => [...prev, data.message]);

          if (socket) {
            socket.emit('send_message', {
              conversationId: conversation.id,
              partnerId: partner.id,
              message: data.message,
              streakCount: data.streakCount
            });
          }
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsUploading(false);
    }
  };

  const handleAddReaction = async (messageId, emoji) => {
    try {
      const res = await fetch(`/api/chats/messages/${messageId}/react`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ emoji })
      });
      if (res.ok) {
        const data = await res.json();
        setMessages((prev) => prev.map((m) => {
          if (m.id === messageId) {
            return { ...m, reactions: JSON.stringify(data.reactions) };
          }
          return m;
        }));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteMessage = async (msgId, deleteType) => {
    try {
      const res = await fetch(`/api/chats/messages/${msgId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ deleteType })
      });

      if (res.ok) {
        setMessages((prev) => prev.filter((m) => m.id !== msgId));
        if (deleteType === 'for_everyone' && socket) {
          socket.emit('delete_message', {
            conversationId: conversation.id,
            messageId: msgId
          });
        }
      }
    } catch (err) {
      console.error('Delete message error:', err);
    } finally {
      setDeleteModalMsg(null);
    }
  };

  const userWallpaper = user?.chat_wallpaper || 'default';
  const isCustomWallpaper = Boolean(userWallpaper && (userWallpaper.startsWith('http') || userWallpaper.startsWith('/uploads')));
  const wallpaperClass = !isCustomWallpaper ? (WALLPAPER_MAP[userWallpaper] || 'bg-dark-950') : '';

  return (
    <div 
      className={`flex-1 flex flex-col h-full ${wallpaperClass} select-none relative overflow-hidden`}
      style={isCustomWallpaper ? { backgroundImage: `url(${userWallpaper})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
    >
      {/* Lightbox Modal */}
      {lightboxMedia && (
        <div 
          onClick={() => setLightboxMedia(null)}
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 cursor-zoom-out"
        >
          <img src={lightboxMedia} alt="Full view" className="max-w-full max-h-[90vh] object-contain rounded-2xl shadow-2xl" />
        </div>
      )}

      {/* Chat Header */}
      <div className="h-16 px-3 sm:px-6 bg-dark-900/90 border-b border-slate-800 flex items-center justify-between backdrop-blur z-10">
        <div className="flex items-center space-x-2 sm:space-x-3 min-w-0">
          {onBack && (
            <button
              onClick={onBack}
              className="md:hidden p-2 -ml-1 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition flex-shrink-0"
              title="Back to chats"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}

          <div 
            onClick={() => setShowPartnerProfile(true)}
            className="flex items-center space-x-2 sm:space-x-3 min-w-0 cursor-pointer hover:opacity-85 transition group"
            title="Click to view full profile & bio"
          >
            <div className="relative flex-shrink-0">
              <img
                src={partner.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${partner.username}`}
                alt={partner.name}
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-slate-800 object-cover border border-slate-700 group-hover:ring-2 group-hover:ring-brand-500/50 transition-all"
              />
              {isPartnerOnline && (
                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-emerald-500 border-2 border-dark-900 shadow-sm" />
              )}
            </div>

            <div className="min-w-0">
              <div className="flex items-center space-x-1.5 sm:space-x-2">
                <h3 className="font-bold text-white text-xs sm:text-sm truncate max-w-[100px] sm:max-w-[180px] group-hover:text-brand-400 transition-colors">
                  {partner.name}
                </h3>
                <span className="text-[11px] sm:text-xs text-brand-400 font-mono truncate max-w-[80px] sm:max-w-[120px]">
                  @{partner.username}
                </span>

                {/* Snapchat Streak Badge in Header */}
                {conversation.streakCount > 0 && (
                  <span className={`px-1.5 sm:px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold flex items-center space-x-1 flex-shrink-0 ${
                    conversation.isExpiringSoon
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse'
                      : 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                  }`}>
                    <Flame className="w-3 h-3 sm:w-3.5 sm:h-3.5 fill-current" />
                    <span>{conversation.streakCount} {conversation.streakCount === 1 ? 'Day' : 'Days'}</span>
                    {conversation.isExpiringSoon && <Clock className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-amber-300 ml-0.5" />}
                  </span>
                )}
              </div>
              <p className="text-[9px] sm:text-[10px] font-mono flex items-center truncate">
                {isPartnerTyping ? (
                  <span className="text-emerald-400 font-bold flex items-center space-x-1 animate-pulse">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping mr-1 inline-block" />
                    <span>typing...</span>
                  </span>
                ) : isPartnerOnline ? (
                  <span className="text-emerald-400 flex items-center space-x-1 font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1 inline-block" />
                    <span>Active now</span>
                  </span>
                ) : (
                  <span className="text-slate-400 truncate">
                    {formatLastSeen(userLastSeen[partner.id] || partner.last_seen)}
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Header Action Buttons (Mutual Call Consent Protected) */}
        <div className="flex items-center space-x-1.5 sm:space-x-2 flex-shrink-0">
          {/* Mutual Audio Call Button */}
          {conversation.mutualAudioAllowed ? (
            <button
              onClick={() => onStartOneOnOneCall('audio')}
              className="p-2 sm:p-2.5 rounded-xl sm:rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white transition shadow-md shadow-emerald-600/20"
              title="Start Audio Call (Mutual Permission Active)"
            >
              <Phone className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>
          ) : (
            <button
              onClick={onOpenCallPermission}
              className="p-2 sm:p-2.5 rounded-xl sm:rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-amber-300 transition flex items-center space-x-1 border border-slate-700/80 group"
              title="Audio Call Locked: Mutual permission required. Click to configure."
            >
              <Phone className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <Lock className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-amber-400" />
            </button>
          )}

          {/* Mutual Video Call Button */}
          {conversation.mutualVideoAllowed ? (
            <button
              onClick={() => onStartOneOnOneCall('video')}
              className="p-2 sm:p-2.5 rounded-xl sm:rounded-2xl bg-brand-600 hover:bg-brand-500 text-white transition shadow-md shadow-brand-600/20"
              title="Start Video Call (Mutual Permission Active)"
            >
              <Video className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>
          ) : (
            <button
              onClick={onOpenCallPermission}
              className="p-2 sm:p-2.5 rounded-xl sm:rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-amber-300 transition flex items-center space-x-1 border border-slate-700/80 group"
              title="Video Call Locked: Mutual permission required. Click to configure."
            >
              <Video className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <Lock className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-amber-400" />
            </button>
          )}
        </div>
      </div>

      {/* Messages List Area */}
      <div className={`flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 ${isCustomWallpaper ? 'bg-black/50 backdrop-blur-[2px]' : ''}`}>
        {messages.map((msg) => {
          const isMe = msg.sender_id === user.id;

          let reactionsObj = {};
          if (msg.reactions) {
            try {
              reactionsObj = typeof msg.reactions === 'string' ? JSON.parse(msg.reactions) : msg.reactions;
            } catch (e) {
              reactionsObj = {};
            }
          }

          return (
            <div
              key={msg.id}
              onMouseEnter={() => setHoveredMessageId(msg.id)}
              onMouseLeave={() => setHoveredMessageId(null)}
              className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} group relative`}
            >
              <div
                className={`max-w-md sm:max-w-lg rounded-3xl p-3.5 shadow-md relative transition-all ${
                  isMe
                    ? 'bg-gradient-to-tr from-brand-600 to-indigo-600 text-white rounded-br-none'
                    : 'bg-dark-900 border border-slate-800/80 text-slate-100 rounded-bl-none'
                }`}
              >
                {/* Text Message */}
                {msg.message_type === 'text' && (
                  <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{msg.content}</p>
                )}

                {/* Voice Note Audio */}
                {msg.message_type === 'voice_note' && (
                  <AudioMessagePlayer
                    fileUrl={msg.file_url}
                    duration={msg.duration}
                    isOutgoing={isMe}
                  />
                )}

                {/* Image */}
                {msg.message_type === 'image' && (
                  <div className="overflow-hidden rounded-2xl cursor-pointer" onClick={() => setLightboxMedia(msg.file_url)}>
                    <img src={msg.file_url} alt="Photo" className="max-w-full max-h-72 object-cover rounded-2xl hover:scale-105 transition" />
                  </div>
                )}

                {/* Video */}
                {msg.message_type === 'video' && (
                  <VideoMessagePlayer
                    fileUrl={msg.file_url}
                    fileName={msg.content || 'video.mp4'}
                    isOutgoing={isMe}
                    onDelete={() => setDeleteModalMsg(msg)}
                  />
                )}

                {/* Audio File */}
                {msg.message_type === 'audio' && (
                  <AudioMessagePlayer
                    fileUrl={msg.file_url}
                    duration={msg.duration}
                    isOutgoing={isMe}
                  />
                )}

                {/* Zoom-Style Video Meeting Invite Card */}
                {msg.message_type === 'meeting_invite' && (
                  <div className="p-3 bg-dark-950/80 rounded-2xl border border-indigo-500/30 text-xs space-y-2">
                    <div className="flex items-center space-x-2 font-bold text-indigo-300">
                      <VideoIcon className="w-4 h-4" />
                      <span>Video Meeting Invitation</span>
                    </div>
                    <p className="text-slate-300">{msg.content}</p>
                    <button
                      onClick={onOpenCreateMeeting}
                      className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-semibold transition flex items-center justify-center space-x-1.5"
                    >
                      <span>Join Video Meeting</span>
                    </button>
                  </div>
                )}

                {/* Timestamp & Status Ticks */}
                <div className={`flex items-center justify-end space-x-1 text-[10px] font-mono mt-1 ${isMe ? 'text-indigo-100/90' : 'text-slate-400'}`}>
                  <span>{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  {isMe && (
                    <span
                      className="inline-flex items-center ml-0.5"
                      title={msg.status === 'read' ? 'Read' : msg.status === 'delivered' ? 'Delivered' : 'Sent'}
                    >
                      {msg.status === 'read' ? (
                        <CheckCheck className="w-3.5 h-3.5 text-sky-400 stroke-[2.5]" />
                      ) : msg.status === 'delivered' ? (
                        <CheckCheck className="w-3.5 h-3.5 text-slate-300/80 stroke-[2]" />
                      ) : (
                        <Check className="w-3.5 h-3.5 text-slate-300/70 stroke-[2]" />
                      )}
                    </span>
                  )}
                </div>

                {/* Reactions list display */}
                {Object.keys(reactionsObj).length > 0 && (
                  <div className="flex items-center space-x-1 mt-1.5 flex-wrap">
                    {Object.entries(reactionsObj).map(([emoji, userIds]) => (
                      <span
                        key={emoji}
                        onClick={() => handleAddReaction(msg.id, emoji)}
                        className="px-2 py-0.5 rounded-full bg-dark-950/90 border border-slate-700/80 text-xs cursor-pointer hover:scale-110 transition flex items-center space-x-1"
                      >
                        <span>{emoji}</span>
                        <span className="text-[10px] font-bold text-slate-300">{userIds.length}</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Floating Emoji Reaction & Action Bar on Hover */}
              {hoveredMessageId === msg.id && (
                <div className={`absolute -top-7 ${isMe ? 'right-0' : 'left-0'} flex items-center space-x-1 bg-dark-900 border border-slate-700/80 p-1 rounded-2xl shadow-xl z-20 animate-slide-up`}>
                  {['❤️', '👍', '😂', '🔥', '😮'].map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => handleAddReaction(msg.id, emoji)}
                      className="hover:scale-125 transition p-1 text-xs"
                    >
                      {emoji}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setDeleteModalMsg(msg)}
                    className="hover:scale-110 text-slate-400 hover:text-red-400 transition p-1 text-xs ml-1 border-l border-slate-700/80 pl-1.5"
                    title="Delete message"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          );
        })}
        {/* Real-time Partner Typing Indicator Bubble */}
        {isPartnerTyping && (
          <div className="flex items-center space-x-2 animate-slide-up pl-1 py-1">
            <img
              src={partner.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${partner.username}`}
              alt=""
              className="w-6 h-6 rounded-full bg-slate-800 object-cover border border-slate-700 flex-shrink-0"
            />
            <div className="bg-dark-900 border border-slate-800 text-slate-300 rounded-2xl rounded-bl-none px-3.5 py-2 flex items-center space-x-2 shadow-md">
              <span className="text-xs text-slate-400 font-mono">@{partner.username} is typing</span>
              <div className="flex space-x-1 items-center">
                <span className="w-1.5 h-1.5 bg-brand-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 bg-brand-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 bg-brand-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Message Input Controls Bar */}
      <div className="p-2.5 sm:p-4 bg-dark-900/90 border-t border-slate-800 backdrop-blur z-10 relative">
        {showEmojiPicker && (
          <EmojiPicker
            onSelect={(emoji) => {
              setTextInput((prev) => prev + emoji);
            }}
            onClose={() => setShowEmojiPicker(false)}
          />
        )}
        {isRecordingVoice ? (
          <VoiceRecorder
            onSendVoiceNote={handleSendVoiceNote}
            onCancel={() => setIsRecordingVoice(false)}
          />
        ) : (
          <form onSubmit={handleSendMessage} className="flex items-center space-x-1.5 sm:space-x-2">
            {/* Emoji Picker Button */}
            <button
              type="button"
              onClick={() => setShowEmojiPicker((prev) => !prev)}
              className={`p-2 sm:p-3 rounded-xl sm:rounded-2xl transition flex-shrink-0 ${
                showEmojiPicker
                  ? 'text-brand-400 bg-brand-500/10'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
              title="Insert Emoji"
            >
              <Smile className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>

            {/* Attachment Button */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-2 sm:p-3 text-slate-400 hover:text-white rounded-xl sm:rounded-2xl hover:bg-slate-800 transition flex-shrink-0"
              title="Attach Photo/Video/Audio"
            >
              <Paperclip className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              className="hidden"
              accept="image/*,video/*,audio/*"
            />

            {/* In-App Voice Recorder Button */}
            <button
              type="button"
              onClick={() => setIsRecordingVoice(true)}
              className="p-2 sm:p-3 text-slate-400 hover:text-brand-400 rounded-xl sm:rounded-2xl hover:bg-slate-800 transition flex-shrink-0"
              title="Record Voice Note"
            >
              <Mic className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>

            {/* Text Input */}
            <input
              type="text"
              value={textInput}
              onChange={handleInputChange}
              placeholder={`Message @${partner.username}...`}
              className="flex-1 bg-dark-950 border border-slate-800 rounded-xl sm:rounded-2xl px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-white focus:outline-none focus:border-brand-500 transition"
            />

            {/* Send Button */}
            <button
              type="submit"
              disabled={!textInput.trim() || isUploading}
              className="p-2 sm:p-3 bg-brand-600 hover:bg-brand-500 disabled:opacity-40 text-white rounded-xl sm:rounded-2xl transition shadow-lg shadow-brand-600/30 flex-shrink-0"
            >
              <Send className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          </form>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteModalMsg && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-dark-900 border border-slate-700/80 rounded-3xl p-5 sm:p-6 max-w-sm w-full shadow-2xl space-y-4">
            <div className="flex items-center space-x-3 text-red-400">
              <div className="p-3 bg-red-500/10 rounded-2xl border border-red-500/20">
                <Trash2 className="w-6 h-6 text-red-400" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Delete Message?</h3>
                <p className="text-xs text-slate-400">Choose how you want to delete this message.</p>
              </div>
            </div>

            <div className="flex flex-col space-y-2 pt-2">
              {/* Delete for everyone option: available if sender or admin */}
              {(deleteModalMsg.sender_id === user?.id || user?.email === 'shailenderga@gmail.com') && (
                <button
                  type="button"
                  onClick={() => handleDeleteMessage(deleteModalMsg.id, 'for_everyone')}
                  className="w-full py-2.5 px-4 bg-red-600 hover:bg-red-500 text-white font-medium text-xs sm:text-sm rounded-2xl transition flex items-center justify-center space-x-2 shadow-lg shadow-red-600/20"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Delete for everyone</span>
                </button>
              )}

              {/* Delete for me option: always available */}
              <button
                type="button"
                onClick={() => handleDeleteMessage(deleteModalMsg.id, 'for_me')}
                className="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-medium text-xs sm:text-sm rounded-2xl transition border border-slate-700/80 flex items-center justify-center space-x-2"
              >
                <span>Delete for me</span>
              </button>

              {/* Cancel option */}
              <button
                type="button"
                onClick={() => setDeleteModalMsg(null)}
                className="w-full py-2 px-4 text-slate-400 hover:text-white font-medium text-xs transition pt-1"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* User Profile Modal */}
      {showPartnerProfile && (
        <UserProfileModal
          targetUser={partner}
          onClose={() => setShowPartnerProfile(false)}
          onStartAudioCall={onStartOneOnOneCall}
          onStartVideoCall={onStartOneOnOneCall}
        />
      )}
    </div>
  );
}
