import React, { useState, useEffect, useRef } from 'react';
import {
  Mic, MicOff, Video, VideoOff, ScreenShare, Hand, MessageSquare,
  Users, PhoneOff, Copy, Check, Shield, Send, X, AlertCircle
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';

export default function MeetingRoomModal({ roomId, initialTitle = 'Video Meeting', isHost = false, onClose }) {
  const { user } = useAuth();
  const { socket } = useSocket();

  const [participants, setParticipants] = useState([]);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isHandRaised, setIsHandRaised] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [copied, setCopied] = useState(false);
  const [waitingGuests, setWaitingGuests] = useState([]);

  const localVideoRef = useRef(null);
  const localStreamRef = useRef(null);
  const screenStreamRef = useRef(null);

  useEffect(() => {
    initLocalMedia();

    return () => {
      leaveMeetingCleanup();
    };
  }, [roomId]);

  const initLocalMedia = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: true
      });
      localStreamRef.current = stream;

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      // Join room via socket
      socket.emit('join_meeting_room', {
        roomId,
        user: {
          id: user.id,
          name: user.name,
          username: user.username,
          avatar: user.avatar,
          isHost
        }
      });

      // Socket event listeners for meeting
      socket.on('meeting_current_participants', (existing) => {
        setParticipants(existing.filter(p => p.id !== user.id));
      });

      socket.on('participant_joined', (newParticipant) => {
        setParticipants(prev => [...prev.filter(p => p.id !== newParticipant.id), newParticipant]);
      });

      socket.on('participant_left', ({ userId }) => {
        setParticipants(prev => prev.filter(p => p.id !== userId));
      });

      socket.on('participant_state_updated', (updated) => {
        setParticipants(prev => prev.map(p => {
          if (p.id === updated.userId) {
            return { ...p, ...updated };
          }
          return p;
        }));
      });

      socket.on('meeting_chat_message', (msg) => {
        setChatMessages(prev => [...prev, msg]);
      });

      // Host waiting room listener
      if (isHost) {
        socket.on('guest_requesting_admission', (guestData) => {
          setWaitingGuests(prev => [...prev, guestData]);
        });
      }

    } catch (err) {
      console.error('Error opening camera for meeting:', err);
      alert('Could not start camera: ' + err.message);
      onClose();
    }
  };

  const toggleMic = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        const newMuteState = !audioTrack.enabled;
        setIsMuted(newMuteState);
        socket.emit('meeting_state_change', {
          roomId,
          userId: user.id,
          isMuted: newMuteState,
          isVideoOff,
          isHandRaised,
          isScreenSharing
        });
      }
    }
  };

  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        const newVideoOffState = !videoTrack.enabled;
        setIsVideoOff(newVideoOffState);
        socket.emit('meeting_state_change', {
          roomId,
          userId: user.id,
          isMuted,
          isVideoOff: newVideoOffState,
          isHandRaised,
          isScreenSharing
        });
      }
    }
  };

  const toggleScreenShare = async () => {
    try {
      if (isScreenSharing) {
        if (screenStreamRef.current) {
          screenStreamRef.current.getTracks().forEach(t => t.stop());
        }
        if (localVideoRef.current && localStreamRef.current) {
          localVideoRef.current.srcObject = localStreamRef.current;
        }
        setIsScreenSharing(false);
        socket.emit('meeting_state_change', {
          roomId,
          userId: user.id,
          isMuted,
          isVideoOff,
          isHandRaised,
          isScreenSharing: false
        });
      } else {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        screenStreamRef.current = screenStream;

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = screenStream;
        }

        screenStream.getVideoTracks()[0].onended = () => {
          toggleScreenShare();
        };

        setIsScreenSharing(true);
        socket.emit('meeting_state_change', {
          roomId,
          userId: user.id,
          isMuted,
          isVideoOff,
          isHandRaised,
          isScreenSharing: true
        });
      }
    } catch (e) {
      console.warn('Screen share canceled or denied:', e);
    }
  };

  const toggleHandRaise = () => {
    const nextHand = !isHandRaised;
    setIsHandRaised(nextHand);
    socket.emit('meeting_state_change', {
      roomId,
      userId: user.id,
      isMuted,
      isVideoOff,
      isHandRaised: nextHand,
      isScreenSharing
    });
  };

  const sendChatMessage = (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    const msg = {
      id: Date.now(),
      senderName: user.name,
      senderUsername: user.username,
      content: chatInput.trim(),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    socket.emit('meeting_chat_message', { roomId, message: msg });
    setChatInput('');
  };

  const admitGuest = (guest) => {
    socket.emit('host_admit_guest', { guestSocketId: guest.socketId, roomId });
    setWaitingGuests(prev => prev.filter(g => g.socketId !== guest.socketId));
  };

  const denyGuest = (guest) => {
    socket.emit('host_deny_guest', { guestSocketId: guest.socketId });
    setWaitingGuests(prev => prev.filter(g => g.socketId !== guest.socketId));
  };

  const copyInvite = () => {
    navigator.clipboard.writeText(`${window.location.origin}/meet/${roomId}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  const leaveMeetingCleanup = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop());
    }
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(t => t.stop());
    }
    socket.emit('leave_meeting_room', { roomId, userId: user.id });
  };

  return (
    <div className="fixed inset-0 z-50 bg-dark-950 flex flex-col justify-between select-none">
      {/* Top Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-dark-900/80 border-b border-slate-800 backdrop-blur z-10">
        <div className="flex items-center space-x-3">
          <div className="px-3 py-1 rounded-xl bg-brand-500/10 border border-brand-500/30 text-brand-400 font-bold text-xs flex items-center space-x-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>LIVE MEETING</span>
          </div>
          <h2 className="text-white font-semibold text-sm sm:text-base truncate max-w-xs">{initialTitle}</h2>
          <span className="text-xs text-slate-400 font-mono hidden sm:inline">({roomId})</span>
        </div>

        {/* Copy Invite Link */}
        <div className="flex items-center space-x-3">
          <button
            onClick={copyInvite}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition border border-slate-700"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            <span>{copied ? 'Link Copied' : 'Invite Link'}</span>
          </button>

          <div className="flex items-center space-x-1 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300">
            <Users className="w-3.5 h-3.5 text-indigo-400" />
            <span>{participants.length + 1}</span>
          </div>
        </div>
      </div>

      {/* Host Waiting Room Admissions Toast */}
      {waitingGuests.length > 0 && (
        <div className="bg-indigo-950/80 border-b border-indigo-500/30 px-6 py-2.5 flex items-center justify-between z-10 animate-slide-up">
          <div className="flex items-center space-x-2 text-xs text-indigo-200">
            <AlertCircle className="w-4 h-4 text-amber-400" />
            <span><strong>{waitingGuests[0].user.name}</strong> (@{waitingGuests[0].user.username}) wants to enter the meeting</span>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => admitGuest(waitingGuests[0])}
              className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-medium transition"
            >
              Admit
            </button>
            <button
              onClick={() => denyGuest(waitingGuests[0])}
              className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium transition"
            >
              Deny
            </button>
          </div>
        </div>
      )}

      {/* Middle Video Grid & In-Meeting Chat Area */}
      <div className="flex-1 flex overflow-hidden p-4 gap-4">
        {/* Participants Video Grid */}
        <div className={`flex-1 grid gap-4 overflow-y-auto ${
          participants.length === 0 ? 'grid-cols-1' :
          participants.length === 1 ? 'grid-cols-1 sm:grid-cols-2' :
          'grid-cols-1 sm:grid-cols-2 md:grid-cols-3'
        }`}>
          {/* Local User Tile */}
          <div className="relative bg-dark-900 border-2 border-slate-800 rounded-3xl overflow-hidden flex items-center justify-center shadow-xl group">
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className={`w-full h-full object-cover ${isVideoOff ? 'hidden' : ''}`}
            />
            {isVideoOff && (
              <div className="flex flex-col items-center space-y-3">
                <img
                  src={user.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${user.username}`}
                  alt={user.name}
                  className="w-20 h-20 rounded-2xl border-2 border-brand-500 bg-slate-800 object-cover"
                />
                <span className="text-sm font-semibold text-slate-300">Camera Off</span>
              </div>
            )}

            {/* Bottom Overlay Info */}
            <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between pointer-events-none">
              <span className="px-3 py-1 rounded-xl bg-black/60 backdrop-blur text-xs font-medium text-white flex items-center space-x-1.5">
                <span>You (@{user.username})</span>
                {isHost && <span className="text-[10px] bg-brand-600 px-1.5 py-0.5 rounded font-bold">HOST</span>}
                {isHandRaised && <span className="text-base animate-bounce">✋</span>}
              </span>
              <div className="flex items-center space-x-1.5">
                {isMuted && (
                  <span className="p-1.5 rounded-lg bg-red-500/80 text-white">
                    <MicOff className="w-3.5 h-3.5" />
                  </span>
                )}
                {isScreenSharing && (
                  <span className="p-1.5 rounded-lg bg-indigo-500/80 text-white">
                    <ScreenShare className="w-3.5 h-3.5" />
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Remote Participants Tiles */}
          {participants.map((p) => (
            <div
              key={p.id}
              className="relative bg-dark-900 border-2 border-slate-800 rounded-3xl overflow-hidden flex items-center justify-center shadow-xl"
            >
              <div className="flex flex-col items-center space-y-3">
                <img
                  src={p.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${p.username}`}
                  alt={p.name}
                  className="w-20 h-20 rounded-2xl border-2 border-slate-700 bg-slate-800 object-cover"
                />
                <span className="text-sm font-semibold text-slate-300">{p.name}</span>
              </div>

              {/* Bottom Info */}
              <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between pointer-events-none">
                <span className="px-3 py-1 rounded-xl bg-black/60 backdrop-blur text-xs font-medium text-white flex items-center space-x-1.5">
                  <span>{p.name}</span>
                  {p.isHandRaised && <span className="text-base animate-bounce">✋</span>}
                </span>
                <div className="flex items-center space-x-1.5">
                  {p.isMuted && (
                    <span className="p-1.5 rounded-lg bg-red-500/80 text-white">
                      <MicOff className="w-3.5 h-3.5" />
                    </span>
                  )}
                  {p.isScreenSharing && (
                    <span className="p-1.5 rounded-lg bg-indigo-500/80 text-white">
                      <ScreenShare className="w-3.5 h-3.5" />
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* In-Meeting Live Chat Sidebar */}
        {showChat && (
          <div className="w-full sm:w-80 absolute sm:relative inset-y-0 right-0 z-20 bg-dark-900 border-l sm:border border-slate-800 sm:rounded-3xl flex flex-col overflow-hidden shadow-2xl animate-slide-up">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <h3 className="font-bold text-sm text-white flex items-center space-x-2">
                <MessageSquare className="w-4 h-4 text-brand-400" />
                <span>In-Meeting Chat</span>
              </h3>
              <button onClick={() => setShowChat(false)} className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {chatMessages.length === 0 ? (
                <div className="text-center text-xs text-slate-500 mt-10">No messages in meeting yet.</div>
              ) : (
                chatMessages.map(m => (
                  <div key={m.id} className="bg-dark-950 p-3 rounded-2xl border border-slate-800 text-xs">
                    <div className="flex items-center justify-between text-slate-400 font-medium mb-1">
                      <span className="text-brand-400 font-semibold">{m.senderName}</span>
                      <span className="text-[10px]">{m.time}</span>
                    </div>
                    <p className="text-slate-200">{m.content}</p>
                  </div>
                ))
              )}
            </div>

            <form onSubmit={sendChatMessage} className="p-3 border-t border-slate-800 flex items-center space-x-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Message participants..."
                className="flex-1 bg-dark-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-500"
              />
              <button
                type="submit"
                className="p-2 bg-brand-600 hover:bg-brand-500 text-white rounded-xl transition flex-shrink-0"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        )}
      </div>

      {/* Bottom Meeting Controls Bar */}
      <div className="bg-dark-900/90 border-t border-slate-800 px-3 sm:px-6 py-2.5 sm:py-4 flex items-center justify-center space-x-2 sm:space-x-4 backdrop-blur z-10 overflow-x-auto">
        <button
          onClick={toggleMic}
          className={`p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl transition shadow-md flex flex-col items-center space-y-1 flex-shrink-0 ${
            isMuted ? 'bg-red-500/20 text-red-400 border border-red-500/40' : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
          }`}
          title={isMuted ? 'Unmute' : 'Mute'}
        >
          {isMuted ? <MicOff className="w-4 h-4 sm:w-5 sm:h-5" /> : <Mic className="w-4 h-4 sm:w-5 sm:h-5" />}
          <span className="text-[10px] font-medium hidden sm:inline">{isMuted ? 'Unmute' : 'Mute'}</span>
        </button>

        <button
          onClick={toggleVideo}
          className={`p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl transition shadow-md flex flex-col items-center space-y-1 flex-shrink-0 ${
            isVideoOff ? 'bg-red-500/20 text-red-400 border border-red-500/40' : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
          }`}
          title={isVideoOff ? 'Start Video' : 'Stop Video'}
        >
          {isVideoOff ? <VideoOff className="w-4 h-4 sm:w-5 sm:h-5" /> : <Video className="w-4 h-4 sm:w-5 sm:h-5" />}
          <span className="text-[10px] font-medium hidden sm:inline">{isVideoOff ? 'Start Video' : 'Stop Video'}</span>
        </button>

        <button
          onClick={toggleScreenShare}
          className={`p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl transition shadow-md flex flex-col items-center space-y-1 flex-shrink-0 ${
            isScreenSharing ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
          }`}
          title="Share Screen"
        >
          <ScreenShare className="w-4 h-4 sm:w-5 sm:h-5" />
          <span className="text-[10px] font-medium hidden sm:inline">{isScreenSharing ? 'Sharing' : 'Share'}</span>
        </button>

        <button
          onClick={toggleHandRaise}
          className={`p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl transition shadow-md flex flex-col items-center space-y-1 flex-shrink-0 ${
            isHandRaised ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
          }`}
          title="Raise Hand"
        >
          <Hand className="w-4 h-4 sm:w-5 sm:h-5" />
          <span className="text-[10px] font-medium hidden sm:inline">{isHandRaised ? 'Hand Up' : 'Raise'}</span>
        </button>

        <button
          onClick={() => setShowChat(!showChat)}
          className={`p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl transition shadow-md flex flex-col items-center space-y-1 flex-shrink-0 ${
            showChat ? 'bg-brand-600 text-white' : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
          }`}
          title="Meeting Chat"
        >
          <MessageSquare className="w-4 h-4 sm:w-5 sm:h-5" />
          <span className="text-[10px] font-medium hidden sm:inline">Chat</span>
        </button>

        <button
          onClick={() => {
            leaveMeetingCleanup();
            onClose();
          }}
          className="p-2.5 sm:p-3.5 bg-red-600 hover:bg-red-500 text-white rounded-xl sm:rounded-2xl transition shadow-lg shadow-red-600/30 flex flex-col items-center space-y-1 flex-shrink-0"
          title="Leave Meeting"
        >
          <PhoneOff className="w-4 h-4 sm:w-5 sm:h-5" />
          <span className="text-[10px] font-medium hidden sm:inline">Leave</span>
        </button>
      </div>
    </div>
  );
}
