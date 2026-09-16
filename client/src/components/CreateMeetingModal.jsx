import React, { useState } from 'react';
import { X, Video, Copy, Check, Share2, ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function CreateMeetingModal({ onClose, onStartMeeting, onShareInChat }) {
  const { token } = useAuth();
  const [title, setTitle] = useState('Video Meeting');
  const [createdRoom, setCreatedRoom] = useState(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/meetings/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ title })
      });
      if (res.ok) {
        const data = await res.json();
        setCreatedRoom(data);
      }
    } catch (e) {
      console.error('Error creating meeting:', e);
    } finally {
      setLoading(false);
    }
  };

  const getFullUrl = () => {
    if (!createdRoom) return '';
    return `${window.location.origin}/meet/${createdRoom.roomId}`;
  };

  const copyLink = () => {
    navigator.clipboard.writeText(getFullUrl());
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-dark-900 border border-slate-700 rounded-3xl max-w-md w-full p-4 sm:p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-slate-400 hover:text-white p-1 rounded-xl hover:bg-slate-800 transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center space-x-3 mb-5">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
            <Video className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Create Group Video Meeting</h3>
            <p className="text-xs text-slate-400">Share unique invite link to start Zoom-style video call</p>
          </div>
        </div>

        {!createdRoom ? (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Meeting Topic / Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Project Discussion, Study Session"
                className="w-full bg-dark-950 border border-slate-800 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:border-brand-500 transition"
              />
            </div>

            <div className="p-4 rounded-2xl bg-indigo-950/20 border border-indigo-900/40 text-xs text-indigo-300 space-y-1">
              <div className="font-semibold text-indigo-200">🔒 Controlled Access</div>
              <p>Only people who receive this unique link can join this meeting. You as host can admit participants.</p>
            </div>

            <button
              onClick={handleCreate}
              disabled={loading}
              className="w-full py-3.5 rounded-2xl bg-brand-600 hover:bg-brand-500 text-white font-semibold text-sm transition shadow-lg shadow-brand-600/30 flex items-center justify-center space-x-2"
            >
              <span>{loading ? 'Creating Meeting Room...' : 'Generate Meeting Link'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center space-x-2">
              <Check className="w-5 h-5 flex-shrink-0" />
              <span>Meeting link ready! Share it with the users you want to invite.</span>
            </div>

            <div className="bg-dark-950 p-4 rounded-2xl border border-slate-800">
              <div className="text-[11px] font-mono text-slate-400 uppercase tracking-wider mb-1">Shareable Invite Link</div>
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  readOnly
                  value={getFullUrl()}
                  className="flex-1 bg-transparent text-xs text-brand-300 font-mono focus:outline-none truncate"
                />
                <button
                  onClick={copyLink}
                  className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white transition flex items-center space-x-1 text-xs"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
              {onShareInChat && (
                <button
                  onClick={() => {
                    onShareInChat(createdRoom.roomId, title);
                    onClose();
                  }}
                  className="py-3 px-4 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition flex items-center justify-center space-x-1 border border-slate-700"
                >
                  <Share2 className="w-4 h-4 text-indigo-400" />
                  <span>Send in Chat</span>
                </button>
              )}

              <button
                onClick={() => {
                  onStartMeeting(createdRoom.roomId, title, true);
                  onClose();
                }}
                className={`py-3 px-4 rounded-2xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold transition shadow-lg shadow-brand-600/30 flex items-center justify-center space-x-1 ${
                  !onShareInChat ? 'col-span-2' : ''
                }`}
              >
                <Video className="w-4 h-4" />
                <span>Join Meeting Now</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
