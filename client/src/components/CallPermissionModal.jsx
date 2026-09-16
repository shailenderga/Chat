import React, { useState, useEffect } from 'react';
import { X, ShieldCheck, Phone, Video, Lock, Unlock, AlertCircle, CheckCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function CallPermissionModal({ partner, onClose, onPermissionChanged }) {
  const { token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [myAudio, setMyAudio] = useState(false);
  const [myVideo, setMyVideo] = useState(false);
  const [theirAudio, setTheirAudio] = useState(false);
  const [theirVideo, setTheirVideo] = useState(false);
  const [mutualAudio, setMutualAudio] = useState(false);
  const [mutualVideo, setMutualVideo] = useState(false);
  const [requestSent, setRequestSent] = useState(false);

  useEffect(() => {
    fetchPermissions();
  }, [partner.id]);

  const fetchPermissions = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/call-permission/${partner.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setMyAudio(data.myAudio);
        setMyVideo(data.myVideo);
        setTheirAudio(data.theirAudio);
        setTheirVideo(data.theirVideo);
        setMutualAudio(data.mutualAudioAllowed);
        setMutualVideo(data.mutualVideoAllowed);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (newAudio, newVideo) => {
    setMyAudio(newAudio);
    setMyVideo(newVideo);
    try {
      const res = await fetch('/api/call-permission/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          targetUserId: partner.id,
          audioAllowed: newAudio,
          videoAllowed: newVideo
        })
      });
      if (res.ok) {
        const data = await res.json();
        setMutualAudio(data.mutualAudioAllowed);
        setMutualVideo(data.mutualVideoAllowed);
        if (onPermissionChanged) {
          onPermissionChanged({
            mutualAudioAllowed: data.mutualAudioAllowed,
            mutualVideoAllowed: data.mutualVideoAllowed
          });
        }
      }
    } catch (e) {
      console.error('Update permission error:', e);
    }
  };

  const sendCallRequest = async (type) => {
    try {
      const res = await fetch('/api/call-permission/request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          targetUserId: partner.id,
          callType: type
        })
      });
      if (res.ok) {
        setRequestSent(true);
        setTimeout(() => setRequestSent(false), 4000);
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-dark-900 border border-slate-700/80 rounded-3xl max-w-md w-full p-4 sm:p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-slate-400 hover:text-white p-1 rounded-xl hover:bg-slate-800 transition"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center space-x-3 mb-5">
          <div className="w-12 h-12 rounded-2xl bg-brand-500/10 border border-brand-500/30 flex items-center justify-center text-brand-400">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Call Permission Security</h3>
            <p className="text-xs text-slate-400">Mutual consent is required for audio & video calls</p>
          </div>
        </div>

        {/* Partner Info */}
        <div className="flex items-center space-x-3 bg-dark-950/60 p-3 rounded-2xl border border-slate-800 mb-6">
          <img
            src={partner.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${partner.username}`}
            alt={partner.name}
            className="w-10 h-10 rounded-xl bg-slate-800 object-cover"
          />
          <div>
            <div className="text-sm font-semibold text-white">{partner.name}</div>
            <div className="text-xs text-brand-400">@{partner.username}</div>
          </div>
        </div>

        {loading ? (
          <div className="py-8 text-center text-slate-400 text-sm">Loading security state...</div>
        ) : (
          <div className="space-y-4">
            {/* Status Summary */}
            <div className="grid grid-cols-2 gap-3">
              <div className={`p-3 rounded-2xl border text-center transition ${
                mutualAudio ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-slate-800/40 border-slate-800 text-slate-400'
              }`}>
                <Phone className="w-5 h-5 mx-auto mb-1" />
                <div className="text-xs font-semibold">Audio Call</div>
                <div className="text-[10px] mt-0.5 font-bold uppercase tracking-wider">
                  {mutualAudio ? 'Unlocked' : 'Mutual Lock'}
                </div>
              </div>

              <div className={`p-3 rounded-2xl border text-center transition ${
                mutualVideo ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-slate-800/40 border-slate-800 text-slate-400'
              }`}>
                <Video className="w-5 h-5 mx-auto mb-1" />
                <div className="text-xs font-semibold">Video Call</div>
                <div className="text-[10px] mt-0.5 font-bold uppercase tracking-wider">
                  {mutualVideo ? 'Unlocked' : 'Mutual Lock'}
                </div>
              </div>
            </div>

            {/* Your Toggles */}
            <div className="bg-dark-950/40 p-4 rounded-2xl border border-slate-800/80 space-y-3">
              <div className="text-xs font-bold text-slate-300 uppercase tracking-wider">Your Permissions to @{partner.username}</div>

              {/* Audio Toggle */}
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 text-sm text-slate-200">
                  <Phone className="w-4 h-4 text-brand-400" />
                  <span>Allow Audio Calling</span>
                </div>
                <button
                  onClick={() => handleToggle(!myAudio, myVideo)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    myAudio ? 'bg-brand-600' : 'bg-slate-700'
                  }`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    myAudio ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
              </div>

              {/* Video Toggle */}
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 text-sm text-slate-200">
                  <Video className="w-4 h-4 text-brand-400" />
                  <span>Allow Video Calling</span>
                </div>
                <button
                  onClick={() => handleToggle(myAudio, !myVideo)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    myVideo ? 'bg-brand-600' : 'bg-slate-700'
                  }`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    myVideo ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
              </div>
            </div>

            {/* Partner's Permission Status */}
            <div className="bg-dark-950/40 p-4 rounded-2xl border border-slate-800/80">
              <div className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">@{partner.username}'s Status</div>
              <div className="flex items-center justify-between text-xs py-1">
                <span className="text-slate-400">Audio call permission granted to you:</span>
                <span className={`font-semibold flex items-center space-x-1 ${theirAudio ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {theirAudio ? <CheckCircle className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                  <span>{theirAudio ? 'Granted' : 'Pending'}</span>
                </span>
              </div>
              <div className="flex items-center justify-between text-xs py-1">
                <span className="text-slate-400">Video call permission granted to you:</span>
                <span className={`font-semibold flex items-center space-x-1 ${theirVideo ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {theirVideo ? <CheckCircle className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                  <span>{theirVideo ? 'Granted' : 'Pending'}</span>
                </span>
              </div>
            </div>

            {/* Request Mutual Consent Button if not granted */}
            {(!theirAudio || !theirVideo) && (
              <button
                disabled={requestSent}
                onClick={() => sendCallRequest('video and audio')}
                className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition flex items-center justify-center space-x-2 border border-slate-700 disabled:opacity-50"
              >
                <AlertCircle className="w-4 h-4 text-amber-400" />
                <span>{requestSent ? 'Permission Request Sent!' : `Ask @${partner.username} to grant call permission`}</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
