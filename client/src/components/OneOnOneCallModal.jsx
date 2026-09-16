import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Video, VideoOff, PhoneOff, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';

export default function OneOnOneCallModal({ partner, callType = 'video', isIncoming = false, incomingSignal = null, onClose }) {
  const { user } = useAuth();
  const { socket } = useSocket();

  const [callStatus, setCallStatus] = useState(isIncoming ? 'ringing' : 'calling'); // 'calling', 'ringing', 'connected', 'ended'
  const [callDuration, setCallDuration] = useState(0);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isVideoMuted, setIsVideoMuted] = useState(callType === 'audio');

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const localStreamRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const timerRef = useRef(null);

  const rtcConfig = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ]
  };

  useEffect(() => {
    initCall();

    return () => {
      endCallCleanup();
    };
  }, []);

  const initCall = async () => {
    try {
      const constraints = {
        audio: true,
        video: callType === 'video'
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      localStreamRef.current = stream;

      if (localVideoRef.current && callType === 'video') {
        localVideoRef.current.srcObject = stream;
      }

      // Create WebRTC PeerConnection
      const pc = new RTCPeerConnection(rtcConfig);
      peerConnectionRef.current = pc;

      // Add local stream tracks to peer connection
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      // Handle remote track
      pc.ontrack = (event) => {
        if (remoteVideoRef.current && event.streams[0]) {
          remoteVideoRef.current.srcObject = event.streams[0];
          setCallStatus('connected');
          startTimer();
        }
      };

      // Handle ICE candidates
      pc.onicecandidate = (event) => {
        if (event.candidate && socket) {
          socket.emit('call_ice_candidate', {
            toUserId: partner.id,
            candidate: event.candidate
          });
        }
      };

      // If initiating outgoing call
      if (!isIncoming) {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        socket.emit('call_user', {
          toUserId: partner.id,
          signalData: offer,
          callType,
          fromUser: user
        });
      } else if (incomingSignal) {
        // We received incoming call offer
        await pc.setRemoteDescription(new RTCSessionDescription(incomingSignal));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        socket.emit('answer_call', {
          toUserId: partner.id,
          signalData: answer
        });
        setCallStatus('connected');
        startTimer();
      }

      // Socket event listeners for call lifecycle
      socket.on('call_accepted', async ({ signal }) => {
        if (pc.signalingState !== 'closed') {
          await pc.setRemoteDescription(new RTCSessionDescription(signal));
          setCallStatus('connected');
          startTimer();
        }
      });

      socket.on('call_rejected', () => {
        setCallStatus('rejected');
        setTimeout(onClose, 2000);
      });

      socket.on('call_ended', () => {
        setCallStatus('ended');
        setTimeout(onClose, 1500);
      });

      socket.on('call_ice_candidate', async ({ candidate }) => {
        try {
          if (pc && pc.remoteDescription) {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
          }
        } catch (e) {
          console.error('ICE candidate error:', e);
        }
      });

    } catch (err) {
      console.error('Media stream error:', err);
      alert('Could not access camera/microphone: ' + err.message);
      onClose();
    }
  };

  const startTimer = () => {
    if (timerRef.current) return;
    timerRef.current = setInterval(() => {
      setCallDuration((prev) => prev + 1);
    }, 1000);
  };

  const toggleMic = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMicMuted(!audioTrack.enabled);
      }
    }
  };

  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoMuted(!videoTrack.enabled);
      }
    }
  };

  const hangUp = () => {
    if (socket) {
      socket.emit('end_call', { toUserId: partner.id });
    }
    endCallCleanup();
    onClose();
  };

  const endCallCleanup = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
    }
  };

  const formatDuration = (secs) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  return (
    <div className="fixed inset-0 z-50 bg-dark-950 flex flex-col items-center justify-between p-6 animate-fade-in select-none">
      {/* Top Bar */}
      <div className="w-full max-w-4xl flex items-center justify-between z-10">
        <div className="flex items-center space-x-3">
          <img
            src={partner.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${partner.username}`}
            alt={partner.name}
            className="w-12 h-12 rounded-2xl border border-slate-700 object-cover"
          />
          <div>
            <h3 className="font-bold text-white text-base">{partner.name}</h3>
            <p className="text-xs text-brand-400">@{partner.username}</p>
          </div>
        </div>

        <div className="px-4 py-1.5 rounded-full bg-slate-900/80 border border-slate-800 text-xs font-mono font-medium text-slate-300">
          {callStatus === 'connected' ? (
            <span className="flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>{formatDuration(callDuration)}</span>
            </span>
          ) : (
            <span className="capitalize">{callStatus}...</span>
          )}
        </div>
      </div>

      {/* Main Video Stage */}
      <div className="relative w-full max-w-4xl flex-1 my-4 bg-dark-900 border border-slate-800 rounded-3xl overflow-hidden flex items-center justify-center shadow-2xl">
        {/* Remote Video / Avatar */}
        {callType === 'video' ? (
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="flex flex-col items-center space-y-4">
            <div className="w-28 h-28 rounded-full bg-brand-500/20 border-2 border-brand-500 flex items-center justify-center animate-pulse">
              <User className="w-14 h-14 text-brand-400" />
            </div>
            <div className="text-slate-300 font-medium">Audio Call Connected</div>
          </div>
        )}

        {/* Local Video Picture-in-Picture */}
        {callType === 'video' && (
          <div className="absolute bottom-3 right-3 sm:bottom-4 sm:right-4 w-24 h-32 sm:w-44 sm:h-60 rounded-xl sm:rounded-2xl overflow-hidden border-2 border-slate-700 bg-slate-950 shadow-2xl">
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className={`w-full h-full object-cover ${isVideoMuted ? 'hidden' : ''}`}
            />
            {isVideoMuted && (
              <div className="w-full h-full flex items-center justify-center bg-slate-900 text-slate-500 text-[10px] sm:text-xs">
                Camera Off
              </div>
            )}
          </div>
        )}
      </div>

      {/* Control Buttons Bar */}
      <div className="flex items-center space-x-3 sm:space-x-4 bg-dark-900/90 border border-slate-800 px-4 sm:px-6 py-2.5 sm:py-3 rounded-2xl sm:rounded-3xl shadow-2xl z-10 backdrop-blur">
        <button
          onClick={toggleMic}
          className={`p-3 sm:p-4 rounded-xl sm:rounded-2xl transition shadow-lg ${
            isMicMuted ? 'bg-red-500/20 text-red-400 border border-red-500/40' : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
          }`}
          title={isMicMuted ? 'Unmute Mic' : 'Mute Mic'}
        >
          {isMicMuted ? <MicOff className="w-5 h-5 sm:w-6 sm:h-6" /> : <Mic className="w-5 h-5 sm:w-6 sm:h-6" />}
        </button>

        {callType === 'video' && (
          <button
            onClick={toggleVideo}
            className={`p-3 sm:p-4 rounded-xl sm:rounded-2xl transition shadow-lg ${
              isVideoMuted ? 'bg-red-500/20 text-red-400 border border-red-500/40' : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
            }`}
            title={isVideoMuted ? 'Turn Camera On' : 'Turn Camera Off'}
          >
            {isVideoMuted ? <VideoOff className="w-5 h-5 sm:w-6 sm:h-6" /> : <Video className="w-5 h-5 sm:w-6 sm:h-6" />}
          </button>
        )}

        <button
          onClick={hangUp}
          className="p-3 sm:p-4 bg-red-600 hover:bg-red-500 text-white rounded-xl sm:rounded-2xl transition shadow-lg shadow-red-600/40"
          title="End Call"
        >
          <PhoneOff className="w-5 h-5 sm:w-6 sm:h-6" />
        </button>
      </div>
    </div>
  );
}
