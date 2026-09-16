import React, { useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  User, Shield, Image as ImageIcon, Bell, Camera, Check, X, 
  Loader2, Sparkles, Volume2, VolumeX, Eye, Lock, Upload, Smartphone,
  Video, ShieldCheck
} from 'lucide-react';

export const WALLPAPER_PRESETS = [
  { id: 'default', name: 'Classic Dark', bgClass: 'bg-dark-950', previewClass: 'bg-slate-950' },
  { id: 'navy', name: 'Midnight Navy', bgClass: 'bg-gradient-to-b from-slate-950 via-indigo-950 to-slate-950', previewClass: 'bg-gradient-to-b from-slate-900 to-indigo-950' },
  { id: 'violet', name: 'Deep Violet', bgClass: 'bg-gradient-to-tr from-[#130722] via-[#1f1035] to-[#0d021a]', previewClass: 'bg-gradient-to-tr from-purple-950 via-slate-950 to-indigo-950' },
  { id: 'emerald', name: 'Emerald Forest', bgClass: 'bg-gradient-to-b from-slate-950 via-emerald-950/40 to-slate-950', previewClass: 'bg-gradient-to-b from-slate-950 to-emerald-950' },
  { id: 'velvet', name: 'Sunset Velvet', bgClass: 'bg-gradient-to-br from-[#1a0a14] via-[#240c1a] to-[#0a0510]', previewClass: 'bg-gradient-to-br from-rose-950 via-purple-950 to-slate-950' },
  { id: 'cyber', name: 'Cyberpunk Neon', bgClass: 'bg-gradient-to-br from-indigo-950 via-slate-950 to-purple-950', previewClass: 'bg-gradient-to-br from-indigo-900 via-purple-950 to-slate-900' }
];

export default function SettingsModal({ onClose, onOpenCreateMeeting, onOpenCallPermission, activeConversation }) {
  const { user, token, updateUser } = useAuth();

  const [activeTab, setActiveTab] = useState('profile'); // 'profile' | 'privacy' | 'meetings' | 'wallpaper' | 'notifications'
  
  // Profile state
  const [name, setName] = useState(user?.name || '');
  const [bio, setBio] = useState(user?.bio || 'Hey there! I am using Wavy.');
  const [avatar, setAvatar] = useState(user?.avatar || '');
  
  // Privacy state
  const [lastSeenPrivacy, setLastSeenPrivacy] = useState(user?.last_seen_privacy || 'everyone');
  const [storyPrivacy, setStoryPrivacy] = useState(user?.story_privacy || 'everyone');

  // Wallpaper state
  const [chatWallpaper, setChatWallpaper] = useState(user?.chat_wallpaper || 'default');

  // Sound state
  const [soundEnabled, setSoundEnabled] = useState(() => {
    return localStorage.getItem('wavy_sound_enabled') !== 'false';
  });

  // UI state
  const [loading, setLoading] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingWallpaper, setUploadingWallpaper] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [notificationPermission, setNotificationPermission] = useState(() => {
    return typeof Notification !== 'undefined' ? Notification.permission : 'unsupported';
  });

  const avatarInputRef = useRef(null);
  const wallpaperInputRef = useRef(null);

  // Handle avatar upload
  const handleAvatarFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingAvatar(true);
    setErrorMsg('');
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/chats/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });
      const data = await res.json();
      const uploadedUrl = data.fileUrl || data.url;
      if (res.ok && uploadedUrl) {
        setAvatar(uploadedUrl);
        // Immediately persist to profile so user sees it right away
        try {
          const profileRes = await fetch('/api/auth/profile', {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({
              name: name.trim() || user?.name,
              bio: bio.trim(),
              avatar: uploadedUrl,
              last_seen_privacy: lastSeenPrivacy,
              story_privacy: storyPrivacy,
              chat_wallpaper: chatWallpaper
            })
          });
          const profileData = await profileRes.json();
          if (profileRes.ok && profileData.user) {
            updateUser(profileData.user);
            setSaveSuccess(true);
            setTimeout(() => setSaveSuccess(false), 2500);
          }
        } catch (saveErr) {
          console.error('Profile auto-save error:', saveErr);
        }
      } else {
        setErrorMsg(data.message || 'Failed to upload image');
      }
    } catch (err) {
      setErrorMsg('Error uploading image');
    } finally {
      setUploadingAvatar(false);
      if (avatarInputRef.current) avatarInputRef.current.value = '';
    }
  };

  // Handle custom wallpaper upload
  const handleWallpaperFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingWallpaper(true);
    setErrorMsg('');
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/chats/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });
      const data = await res.json();
      const uploadedUrl = data.fileUrl || data.url;
      if (res.ok && uploadedUrl) {
        setChatWallpaper(uploadedUrl);
        // Immediately persist to profile
        try {
          const profileRes = await fetch('/api/auth/profile', {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({
              name: name.trim() || user?.name,
              bio: bio.trim(),
              avatar,
              last_seen_privacy: lastSeenPrivacy,
              story_privacy: storyPrivacy,
              chat_wallpaper: uploadedUrl
            })
          });
          const profileData = await profileRes.json();
          if (profileRes.ok && profileData.user) {
            updateUser(profileData.user);
            setSaveSuccess(true);
            setTimeout(() => setSaveSuccess(false), 2500);
          }
        } catch (saveErr) {
          console.error('Wallpaper auto-save error:', saveErr);
        }
      } else {
        setErrorMsg(data.message || 'Failed to upload wallpaper image');
      }
    } catch (err) {
      setErrorMsg('Error uploading wallpaper image');
    } finally {
      setUploadingWallpaper(false);
      if (wallpaperInputRef.current) wallpaperInputRef.current.value = '';
    }
  };

  // Toggle Notification Permission
  const requestNotificationPermission = async () => {
    if (typeof Notification === 'undefined') {
      alert('Notifications are not supported by this browser');
      return;
    }
    try {
      const perm = await Notification.requestPermission();
      setNotificationPermission(perm);
      if (perm === 'granted') {
        new Notification('Wavy Chat', {
          body: 'Notifications are now enabled! You will be alerted on new messages.',
          icon: '/favicon.ico'
        });
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Test Notification
  const sendTestNotification = () => {
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      new Notification('Wavy Notification Test', {
        body: 'Realtime notifications are working perfectly on this device! 🌊',
        icon: avatar || '/favicon.ico'
      });
    } else {
      requestNotificationPermission();
    }
  };

  // Toggle sound
  const handleSoundToggle = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    localStorage.setItem('wavy_sound_enabled', next ? 'true' : 'false');
  };

  // Save Settings
  const handleSave = async () => {
    setLoading(true);
    setErrorMsg('');
    setSaveSuccess(false);

    try {
      const res = await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          name: name.trim() || user.name,
          bio: bio.trim(),
          avatar,
          last_seen_privacy: lastSeenPrivacy,
          story_privacy: storyPrivacy,
          chat_wallpaper: chatWallpaper
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to update settings');
      }

      if (data.user) {
        updateUser(data.user);
      }
      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
      }, 2500);
    } catch (err) {
      setErrorMsg(err.message || 'Could not save settings');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/70 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-white/10 rounded-2xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 bg-slate-900/80">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-brand-500/10 text-brand-400 border border-brand-500/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-wide">Settings</h2>
              <p className="text-xs text-slate-400">Manage profile, privacy, wallpaper & notifications</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center border-b border-white/10 px-4 bg-slate-950/40 overflow-x-auto scrollbar-none">
          <button
            onClick={() => setActiveTab('profile')}
            className={`flex items-center gap-2 py-3 px-3.5 border-b-2 text-xs sm:text-sm font-semibold transition-all whitespace-nowrap ${
              activeTab === 'profile'
                ? 'border-brand-500 text-brand-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <User className="w-4 h-4" />
            Profile
          </button>
          <button
            onClick={() => setActiveTab('privacy')}
            className={`flex items-center gap-2 py-3 px-3.5 border-b-2 text-xs sm:text-sm font-semibold transition-all whitespace-nowrap ${
              activeTab === 'privacy'
                ? 'border-brand-500 text-brand-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Shield className="w-4 h-4" />
            Privacy & Shield
          </button>
          <button
            onClick={() => setActiveTab('meetings')}
            className={`flex items-center gap-2 py-3 px-3.5 border-b-2 text-xs sm:text-sm font-semibold transition-all whitespace-nowrap ${
              activeTab === 'meetings'
                ? 'border-brand-500 text-brand-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Video className="w-4 h-4" />
            Video Meetings & Calls
          </button>
          <button
            onClick={() => setActiveTab('wallpaper')}
            className={`flex items-center gap-2 py-3 px-3.5 border-b-2 text-xs sm:text-sm font-semibold transition-all whitespace-nowrap ${
              activeTab === 'wallpaper'
                ? 'border-brand-500 text-brand-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <ImageIcon className="w-4 h-4" />
            Chat Wallpaper
          </button>
          <button
            onClick={() => setActiveTab('notifications')}
            className={`flex items-center gap-2 py-3 px-3.5 border-b-2 text-xs sm:text-sm font-semibold transition-all whitespace-nowrap ${
              activeTab === 'notifications'
                ? 'border-brand-500 text-brand-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Bell className="w-4 h-4" />
            Notifications
          </button>
        </div>

        {/* Tab Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">

          {/* TAB 1: PROFILE */}
          {activeTab === 'profile' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              {/* Avatar Section */}
              <div className="flex flex-col sm:flex-row items-center gap-5 p-4 rounded-2xl bg-white/[0.02] border border-white/5">
                <div className="relative group">
                  <img
                    src={avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${user?.id || 'wavy'}`}
                    alt="Profile"
                    className="w-24 h-24 rounded-2xl object-cover ring-2 ring-brand-500/40 shadow-xl"
                  />
                  <button
                    type="button"
                    onClick={() => avatarInputRef.current?.click()}
                    disabled={uploadingAvatar}
                    className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 rounded-2xl flex flex-col items-center justify-center text-white transition-opacity cursor-pointer"
                  >
                    {uploadingAvatar ? (
                      <Loader2 className="w-6 h-6 animate-spin text-brand-400" />
                    ) : (
                      <>
                        <Camera className="w-6 h-6 mb-1" />
                        <span className="text-[10px] font-medium">Change</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="flex-1 text-center sm:text-left space-y-2">
                  <h3 className="text-base font-semibold text-white">Profile Photo</h3>
                  <p className="text-xs text-slate-400">
                    Upload a custom picture or choose an animated avatar
                  </p>
                  <div className="flex flex-wrap gap-2 justify-center sm:justify-start pt-1">
                    <button
                      type="button"
                      onClick={() => avatarInputRef.current?.click()}
                      disabled={uploadingAvatar}
                      className="px-3 py-1.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-xs font-medium flex items-center gap-1.5 transition-colors"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      {uploadingAvatar ? 'Uploading...' : 'Upload Photo'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setAvatar(`https://api.dicebear.com/7.x/bottts/svg?seed=${Date.now()}`)}
                      className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-200 text-xs font-medium border border-white/10 transition-colors"
                    >
                      🎲 Random Avatar
                    </button>
                  </div>
                  <input
                    ref={avatarInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarFileChange}
                    className="hidden"
                  />
                </div>
              </div>

              {/* Name & Bio */}
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                    Display Name
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter your name"
                    className="w-full bg-slate-950/60 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                    About / Bio
                  </label>
                  <textarea
                    rows={3}
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="Tell your friends what's up..."
                    className="w-full bg-slate-950/60 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all resize-none"
                  />
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {['Available', 'Busy', 'At work', 'In a meeting', 'Wavy Vibes 🌊'].map((presetBio) => (
                      <button
                        key={presetBio}
                        type="button"
                        onClick={() => setBio(presetBio)}
                        className="text-[11px] px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white border border-white/5 transition-colors"
                      >
                        {presetBio}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    Email Address
                  </label>
                  <div className="text-sm text-slate-400 bg-slate-950/30 border border-white/5 rounded-xl px-3.5 py-2.5">
                    {user?.email}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: PRIVACY */}
          {activeTab === 'privacy' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              
              {/* Last Seen & Online Status */}
              <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-3">
                <div className="flex items-center gap-2 text-white font-semibold text-sm">
                  <Eye className="w-4 h-4 text-brand-400" />
                  Who can see my Last Seen & Online Status?
                </div>
                <p className="text-xs text-slate-400">
                  Control who sees when you were last active or if you are currently online.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                  {[
                    { value: 'everyone', label: 'Everyone', desc: 'Anyone on Wavy' },
                    { value: 'friends', label: 'My Friends', desc: 'Accepted contacts only' },
                    { value: 'nobody', label: 'Nobody', desc: 'Keep status hidden' }
                  ].map((opt) => (
                    <label
                      key={opt.value}
                      className={`flex flex-col p-3 rounded-xl border cursor-pointer transition-all ${
                        lastSeenPrivacy === opt.value
                          ? 'border-brand-500 bg-brand-500/10 text-white'
                          : 'border-white/10 bg-white/[0.02] text-slate-300 hover:bg-white/5'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold">{opt.label}</span>
                        <input
                          type="radio"
                          name="lastSeenPrivacy"
                          value={opt.value}
                          checked={lastSeenPrivacy === opt.value}
                          onChange={(e) => setLastSeenPrivacy(e.target.value)}
                          className="text-brand-500 focus:ring-0"
                        />
                      </div>
                      <span className="text-[11px] text-slate-400 mt-1">{opt.desc}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Story Privacy */}
              <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-3">
                <div className="flex items-center gap-2 text-white font-semibold text-sm">
                  <Sparkles className="w-4 h-4 text-purple-400" />
                  Who can see my 24h Status Stories?
                </div>
                <p className="text-xs text-slate-400">
                  Stories disappear after 24 hours. Choose who has permission to view them.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                  {[
                    { value: 'everyone', label: 'Everyone', desc: 'All community users' },
                    { value: 'friends', label: 'My Friends', desc: 'Mutual friends only' },
                    { value: 'nobody', label: 'Nobody', desc: 'Only me (Private draft)' }
                  ].map((opt) => (
                    <label
                      key={opt.value}
                      className={`flex flex-col p-3 rounded-xl border cursor-pointer transition-all ${
                        storyPrivacy === opt.value
                          ? 'border-purple-500 bg-purple-500/10 text-white'
                          : 'border-white/10 bg-white/[0.02] text-slate-300 hover:bg-white/5'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold">{opt.label}</span>
                        <input
                          type="radio"
                          name="storyPrivacy"
                          value={opt.value}
                          checked={storyPrivacy === opt.value}
                          onChange={(e) => setStoryPrivacy(e.target.value)}
                          className="text-purple-500 focus:ring-0"
                        />
                      </div>
                      <span className="text-[11px] text-slate-400 mt-1">{opt.desc}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Anti-Screenshot Privacy Shield Status Card */}
              <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[10px] sm:text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center space-x-1">
                      <Shield className="w-3.5 h-3.5" />
                      <span>SHIELD</span>
                    </span>
                    <span className="text-xs font-bold text-white">Anti-Screenshot & Private Guard</span>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold">
                    ACTIVE
                  </span>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  Frosted screen blackout triggers immediately when switching tabs or activating screenshot tools (Snipping Tool, PrintScreen, Ctrl+S). Watermarked UID & timestamp protects chats from external photography.
                </p>
              </div>

              {/* Call Permission Security Manager Card */}
              <div className="p-4 rounded-2xl bg-slate-950/40 border border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      <ShieldCheck className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-xs sm:text-sm font-semibold text-white">Call Permissions & Mutual Security</h4>
                      <p className="text-[11px] text-slate-400">1-on-1 audio & video calls require mutual approval</p>
                    </div>
                  </div>
                  {onOpenCallPermission && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose?.();
                        onOpenCallPermission?.();
                      }}
                      className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-emerald-400 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Manage</span>
                    </button>
                  )}
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Calls cannot ring until both participants have mutually granted permission, keeping you safe from unwanted incoming calls.
                </p>
              </div>

            </div>
          )}

          {/* TAB: VIDEO MEETINGS & CALLS */}
          {activeTab === 'meetings' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              {/* Zoom-Style Video Meeting Creator */}
              <div className="p-5 rounded-2xl bg-gradient-to-br from-indigo-950/60 via-slate-900 to-brand-950/40 border border-indigo-500/30 space-y-4 shadow-xl">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-2xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/40 shadow-md">
                      <Video className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-white">Zoom-Style Video Meeting</h3>
                      <p className="text-xs text-slate-400">Host an encrypted video conference with shareable room link</p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      onClose?.();
                      onOpenCreateMeeting?.();
                    }}
                    className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-brand-600 hover:from-indigo-500 hover:to-brand-500 text-white font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30 transition-all cursor-pointer"
                  >
                    <Video className="w-4 h-4" />
                    <span>New Meeting</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-xs">
                  <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5 space-y-1">
                    <div className="font-semibold text-white">🔗 Shareable Link</div>
                    <div className="text-[11px] text-slate-400">Instant invite link to join from browser</div>
                  </div>
                  <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5 space-y-1">
                    <div className="font-semibold text-white">🖥️ Screen Sharing</div>
                    <div className="text-[11px] text-slate-400">Present windows, documents, and slides</div>
                  </div>
                  <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5 space-y-1">
                    <div className="font-semibold text-white">🚪 Waiting Room</div>
                    <div className="text-[11px] text-slate-400">Host approves or rejects join requests</div>
                  </div>
                </div>
              </div>

              {/* 1-on-1 Call Permission Security Card */}
              <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      <ShieldCheck className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-xs sm:text-sm font-semibold text-white">1-on-1 Call Permission Security</h4>
                      <p className="text-[11px] text-slate-400">Manage audio & video call consent with your contacts</p>
                    </div>
                  </div>

                  {onOpenCallPermission && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose?.();
                        onOpenCallPermission?.();
                      }}
                      className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>Manage Permissions</span>
                    </button>
                  )}
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Audio & video calls in direct chats remain locked until both users give permission.
                </p>
              </div>
            </div>
          )}

          {/* TAB 3: CHAT WALLPAPER */}
          {activeTab === 'wallpaper' && (
            <div className="space-y-5 animate-in fade-in duration-150">
              <div>
                <h3 className="text-sm font-semibold text-white">Chat Background Theme</h3>
                <p className="text-xs text-slate-400">
                  Choose a sleek gradient preset or upload your own wallpaper image
                </p>
              </div>

              {/* Presets Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {WALLPAPER_PRESETS.map((preset) => {
                  const isSelected = chatWallpaper === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => setChatWallpaper(preset.id)}
                      className={`relative p-3 rounded-2xl border text-left transition-all overflow-hidden flex flex-col justify-between h-28 ${
                        isSelected
                          ? 'border-brand-500 ring-2 ring-brand-500/40 shadow-lg'
                          : 'border-white/10 hover:border-white/20'
                      }`}
                    >
                      {/* Background sample */}
                      <div className={`absolute inset-0 ${preset.previewClass} -z-10`} />
                      <div className="flex justify-between items-center w-full">
                        <span className="text-xs font-bold text-white drop-shadow">
                          {preset.name}
                        </span>
                        {isSelected && (
                          <div className="w-5 h-5 rounded-full bg-brand-500 flex items-center justify-center text-white">
                            <Check className="w-3 h-3 stroke-[3]" />
                          </div>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-300/80">Preset theme</div>
                    </button>
                  );
                })}
              </div>

              {/* Custom Image Wallpaper */}
              <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <h4 className="text-xs font-semibold text-white">Custom Wallpaper Image</h4>
                    <p className="text-[11px] text-slate-400">Upload a background photo for your chat window</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => wallpaperInputRef.current?.click()}
                    disabled={uploadingWallpaper}
                    className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-medium flex items-center gap-1.5 transition-colors"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    {uploadingWallpaper ? 'Uploading...' : 'Upload Image'}
                  </button>
                </div>
                <input
                  ref={wallpaperInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleWallpaperFileChange}
                  className="hidden"
                />

                {/* Custom Wallpaper Preview if active */}
                {chatWallpaper && (chatWallpaper.startsWith('http') || chatWallpaper.startsWith('/uploads')) && (
                  <div className="relative h-24 rounded-xl overflow-hidden border border-brand-500/40 group">
                    <img
                      src={chatWallpaper}
                      alt="Custom Wallpaper"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-between px-4 text-white">
                      <span className="text-xs font-semibold">Active Custom Wallpaper</span>
                      <button
                        type="button"
                        onClick={() => setChatWallpaper('default')}
                        className="text-xs text-rose-400 hover:text-rose-300 bg-black/60 px-2 py-1 rounded-lg"
                      >
                        Reset to Default
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: NOTIFICATIONS & SOUND */}
          {activeTab === 'notifications' && (
            <div className="space-y-5 animate-in fade-in duration-150">
              {/* Push Notifications Status */}
              <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400">
                      <Smartphone className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-white">Device Push Notifications</h4>
                      <p className="text-xs text-slate-400">
                        Status:{' '}
                        <span className={`font-semibold capitalize ${
                          notificationPermission === 'granted' ? 'text-emerald-400' : 'text-amber-400'
                        }`}>
                          {notificationPermission}
                        </span>
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    {notificationPermission !== 'granted' ? (
                      <button
                        type="button"
                        onClick={requestNotificationPermission}
                        className="px-3 py-1.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-xs font-medium transition-colors"
                      >
                        Enable Notifications
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={sendTestNotification}
                        className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-slate-200 text-xs font-medium transition-colors"
                      >
                        Test Push Alert
                      </button>
                    )}
                  </div>
                </div>
                <p className="text-[11px] text-slate-400">
                  When enabled, you will receive phone/desktop alerts whenever someone sends you a message, even if Wavy is in the background.
                </p>
              </div>

              {/* Sound Notifications Toggle */}
              <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-xl ${soundEnabled ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-800 text-slate-400'}`}>
                    {soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-white">In-App Chat Sounds</h4>
                    <p className="text-xs text-slate-400">Play chime on sending and receiving messages</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleSoundToggle}
                  className={`w-12 h-6 rounded-full transition-colors relative ${
                    soundEnabled ? 'bg-brand-500' : 'bg-slate-700'
                  }`}
                >
                  <span
                    className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${
                      soundEnabled ? 'translate-x-6' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* About App */}
              <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 text-xs text-slate-400 space-y-1">
                <div className="text-white font-semibold flex items-center justify-between">
                  <span>Wavy Chat v2.0</span>
                  <span className="text-[11px] text-brand-400 font-medium">Created by Shailender Gautam</span>
                </div>
                <p>Real-time encrypted chat, 24h stories, voice & video notes, streaks, and privacy controls.</p>
              </div>
            </div>
          )}

        </div>

        {/* Footer actions */}
        <div className="px-5 py-4 border-t border-white/10 bg-slate-900/90 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {saveSuccess && (
              <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400 animate-in fade-in">
                <Check className="w-4 h-4" />
                Settings saved successfully!
              </span>
            )}
            {errorMsg && (
              <span className="text-xs font-semibold text-rose-400 animate-in fade-in">
                {errorMsg}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs sm:text-sm font-medium text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={loading}
              className="px-5 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-brand-500 hover:bg-brand-600 text-white shadow-lg shadow-brand-500/25 flex items-center gap-2 transition-all disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

