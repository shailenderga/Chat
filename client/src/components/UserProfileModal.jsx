import React, { useState, useEffect } from 'react';
import { 
  X, MessageSquare, Phone, Video, Calendar, Shield, Flame, 
  Copy, Check, UserCheck, Sparkles, ZoomIn, Eye, Clock, Lock
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';

export default function UserProfileModal({
  targetUser,
  onClose,
  onStartChat,
  onStartAudioCall,
  onStartVideoCall
}) {
  const { token } = useAuth();
  const { onlineUsers, userLastSeen } = useSocket();

  const [profile, setProfile] = useState(targetUser || {});
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showFullPhoto, setShowFullPhoto] = useState(false);

  // Fetch complete profile details from server
  useEffect(() => {
    if (!targetUser?.id) return;
    const fetchProfile = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/users/${targetUser.id}/profile`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setProfile((prev) => ({ ...prev, ...data }));
        }
      } catch (err) {
        console.error('Error fetching profile:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [targetUser?.id, token]);

  const isOnline = onlineUsers.has(profile.id) || profile.status === 'online';

  const formatLastSeen = (timeStr) => {
    if (profile.last_seen_privacy === 'nobody') return 'Offline';
    if (!timeStr) return 'Offline';
    const date = new Date(timeStr);
    if (isNaN(date.getTime())) return 'Offline';
    const now = new Date();
    const diffMin = Math.floor((now - date) / 60000);
    if (diffMin < 1) return 'Active just now';
    if (diffMin < 60) return `Active ${diffMin}m ago`;
    if (date.toDateString() === now.toDateString()) {
      return `Last seen today at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }
    return `Last seen ${date.toLocaleDateString([], { month: 'short', day: 'numeric' })}`;
  };

  const formatJoinDate = (dateStr) => {
    if (!dateStr) return 'Active Member';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return 'Active Member';
    return `Joined ${d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`;
  };

  const handleCopyUsername = () => {
    if (!profile.username) return;
    navigator.clipboard.writeText(`@${profile.username}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      {/* Lightbox for Profile Photo */}
      {showFullPhoto && (
        <div
          onClick={() => setShowFullPhoto(false)}
          className="fixed inset-0 z-[60] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 cursor-zoom-out animate-in fade-in duration-150"
        >
          <img
            src={profile.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${profile.username || 'user'}`}
            alt={profile.name}
            className="max-w-full max-h-[85vh] rounded-3xl object-contain shadow-2xl ring-2 ring-white/10"
          />
        </div>
      )}

      {/* Main Profile Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
        <div className="relative w-full max-w-md bg-slate-900 border border-white/10 rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
          
          {/* Header Banner */}
          <div className="h-28 bg-gradient-to-tr from-brand-700 via-indigo-700 to-purple-800 relative p-4 flex items-start justify-between">
            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-black/30 backdrop-blur-md text-white/90 border border-white/10 flex items-center gap-1">
              <Shield className="w-3 h-3 text-emerald-400" />
              <span>Wavy Verified</span>
            </span>

            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center transition-colors cursor-pointer"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Avatar & Main Info */}
          <div className="px-6 pb-6 pt-0 relative space-y-4">
            {/* Avatar positioning overlapping banner */}
            <div className="flex items-end justify-between -mt-14 mb-2">
              <div className="relative group cursor-pointer" onClick={() => setShowFullPhoto(true)}>
                <img
                  src={profile.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${profile.username || 'user'}`}
                  alt={profile.name}
                  className="w-24 h-24 rounded-2xl object-cover ring-4 ring-slate-900 shadow-2xl bg-slate-800"
                />
                <div className="absolute inset-0 rounded-2xl bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white">
                  <ZoomIn className="w-5 h-5" />
                </div>
                {/* Online indicator */}
                {isOnline && (
                  <span className="absolute bottom-1 right-1 w-4 h-4 rounded-full bg-emerald-500 ring-2 ring-slate-900 shadow" />
                )}
              </div>

              {/* Status Badge */}
              <div className="pb-1">
                {isOnline ? (
                  <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    Online Now
                  </span>
                ) : (
                  <span className="px-3 py-1 rounded-full text-xs font-medium bg-slate-800 text-slate-400 border border-slate-700 flex items-center gap-1.5">
                    <Clock className="w-3 h-3 text-slate-400" />
                    {formatLastSeen(userLastSeen[profile.id] || profile.last_seen)}
                  </span>
                )}
              </div>
            </div>

            {/* Name & Handle */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-white tracking-tight">{profile.name}</h2>
                {profile.streakCount > 0 && (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-orange-500/15 text-orange-400 border border-orange-500/30 flex items-center gap-1">
                    <Flame className="w-3.5 h-3.5 fill-current" />
                    <span>{profile.streakCount} {profile.streakCount === 1 ? 'Day' : 'Days'}</span>
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyUsername}
                  className="flex items-center gap-1 text-xs text-brand-400 hover:text-brand-300 font-mono transition-colors group cursor-pointer"
                  title="Click to copy handle"
                >
                  <span>@{profile.username}</span>
                  {copied ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3 h-3 opacity-60 group-hover:opacity-100" />
                  )}
                </button>
                {copied && (
                  <span className="text-[10px] text-emerald-400 animate-in fade-in">Copied!</span>
                )}
              </div>
            </div>

            {/* Bio Card */}
            <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/5 space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-brand-400" />
                About / Bio
              </span>
              <p className="text-xs sm:text-sm text-slate-200 leading-relaxed italic">
                "{profile.bio || 'Hey there! I am using Wavy.'}"
              </p>
            </div>

            {/* Details & Badges Grid */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 rounded-xl bg-slate-950/40 border border-white/5 flex items-center gap-2 text-slate-300">
                <Calendar className="w-4 h-4 text-brand-400 flex-shrink-0" />
                <span className="truncate">{formatJoinDate(profile.created_at)}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-950/40 border border-white/5 flex items-center gap-2 text-slate-300">
                <UserCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <span className="truncate">
                  {profile.isFriend ? 'Connected Friends' : 'Community Member'}
                </span>
              </div>
            </div>

            {/* Quick Action Buttons */}
            <div className="pt-2 flex items-center gap-2">
              {onStartChat && (
                <button
                  type="button"
                  onClick={() => {
                    onClose?.();
                    onStartChat?.(profile.id);
                  }}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-brand-600/30 transition-all cursor-pointer"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>Message</span>
                </button>
              )}

              {onStartAudioCall && (
                <button
                  type="button"
                  onClick={() => {
                    onClose?.();
                    onStartAudioCall?.('audio');
                  }}
                  className="p-2.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 transition-colors"
                  title="Start Audio Call"
                >
                  <Phone className="w-4 h-4" />
                </button>
              )}

              {onStartVideoCall && (
                <button
                  type="button"
                  onClick={() => {
                    onClose?.();
                    onStartVideoCall?.('video');
                  }}
                  className="p-2.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-400 border border-indigo-500/30 transition-colors"
                  title="Start Video Call"
                >
                  <Video className="w-4 h-4" />
                </button>
              )}
            </div>

          </div>

        </div>
      </div>
    </>
  );
}

