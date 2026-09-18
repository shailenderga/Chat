import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Video, VideoOff, Phone, PhoneOff, User, PhoneCall, Volume2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';

export default function OneOnOneCallModal({
  partner,
  callType = 'video',
  isIncoming = false,
  incomingSignal = null,
  onClose
}) {
  const { user } = useAuth();
  const { socket } = useSocket();

  const [callStatus, setCallStatus] = useState(isIncoming ? 'incoming' : 'calling');
  const [callDuration, setCallDuration] = useState(0);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isVideoMuted, setIsVideoMuted] = useState(callType === 'audio');
  const [mediaError, setMediaError] = useState(null);

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const localStreamRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const timerRef = useRef(null);
  const iceCandidatesQueueRef = useRef([]);

  const rtcConfig = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' }
    ]
  };

  // Graceful user media acquisition with audio fallback
  const getMediaStream = async (wantVideo) => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('Camera/Microphone is not supported in this browser or requires HTTPS.');
    }

    if (wantVideo) {
      try {
        return await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      } catch (err) {
        console.warn('Video acquisition failed, falling back to audio only:', err.message);
        setIsVideoMuted(true);
        return await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      }
    } else {
      return await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    }
  };

  // Flush buffered ICE candidates once remote description is active
  const flushIceCandidates = async (pc) => {
    while (iceCandidatesQueueRef.current.length > 0) {
      const cand = iceCandidatesQueueRef.current.shift();
      try {
        await pc.addIceCandidate(new RTCIceCandidate(cand));
      } catch (err) {
        console.warn('Flushing ICE candidate warning:', err.message);
      }
    }
  };

  // Clean up all resources
  const endCallCleanup = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    iceCandidatesQueueRef.current = [];
  };

  const startTimer = () => {
    if (timerRef.current) return;
    timerRef.current = setInterval(() => {
      setCallDuration((prev) => prev + 1);
    }, 1000);
  };

  // Helper to attach streams to video and audio elements
  const attachRemoteStream = (stream) => {
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = stream;
      remoteVideoRef.current.play().catch(e => console.warn('Remote video play warning:', e));
    }
    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = stream;
      remoteAudioRef.current.play().catch(e => console.warn('Remote audio play warning:', e));
    }
  };

  // Initialize outgoing call
  const initOutgoingCall = async () => {
    try {
      setMediaError(null);
      const wantVideo = callType === 'video';
      const stream = await getMediaStream(wantVideo);
      localStreamRef.current = stream;

      if (localVideoRef.current && wantVideo) {
        localVideoRef.current.srcObject = stream;
      }

      const pc = new RTCPeerConnection(rtcConfig);
      peerConnectionRef.current = pc;

      // Add local tracks
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      // Handle remote tracks
      pc.ontrack = (event) => {
        if (event.streams && event.streams[0]) {
          attachRemoteStream(event.streams[0]);
          setCallStatus('connected');
          startTimer();
        }
      };

      // Handle ICE candidates
      pc.onicecandidate = (event) => {
        if (event.candidate && socket && partner?.id) {
          socket.emit('call_ice_candidate', {
            toUserId: partner.id,
            candidate: event.candidate
          });
        }
      };

      // Create & send offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      socket.emit('call_user', {
        toUserId: partner.id,
        signalData: offer,
        callType,
        fromUser: user
      });
    } catch (err) {
      console.error('Outgoing call setup error:', err);
      setMediaError(err.message || 'Could not access camera/microphone');
      setCallStatus('ended');
      setTimeout(onClose, 3000);
    }
  };

  // Recipient clicks "Accept Call"
  const handleAcceptCall = async () => {
    try {
      setCallStatus('connecting');
      setMediaError(null);

      const wantVideo = callType === 'video';
      const stream = await getMediaStream(wantVideo);
      localStreamRef.current = stream;

      if (localVideoRef.current && wantVideo) {
        localVideoRef.current.srcObject = stream;
      }

      const pc = new RTCPeerConnection(rtcConfig);
      peerConnectionRef.current = pc;

      // Add local tracks
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      // Handle remote tracks
      pc.ontrack = (event) => {
        if (event.streams && event.streams[0]) {
          attachRemoteStream(event.streams[0]);
          setCallStatus('connected');
          startTimer();
        }
      };

      // Handle ICE candidates
      pc.onicecandidate = (event) => {
        if (event.candidate && socket && partner?.id) {
          socket.emit('call_ice_candidate', {
            toUserId: partner.id,
            candidate: event.candidate
          });
        }
      };

      // Set remote offer
      if (incomingSignal) {
        await pc.setRemoteDescription(new RTCSessionDescription(incomingSignal));
        await flushIceCandidates(pc);

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        socket.emit('answer_call', {
          toUserId: partner.id,
          signalData: answer
        });

        setCallStatus('connected');
        startTimer();
      }
    } catch (err) {
      console.error('Accept call error:', err);
      setMediaError(err.message || 'Could not access camera/microphone');
      setCallStatus('ended');
      setTimeout(onClose, 3000);
    }
  };

  // Recipient clicks "Decline Call"
  const handleRejectCall = () => {
    if (socket && partner?.id) {
      socket.emit('reject_call', { toUserId: partner.id });
    }
    endCallCleanup();
    onClose();
  };

  // Caller ends or either side hangs up
  const hangUp = () => {
    if (socket && partner?.id) {
      socket.emit('end_call', { toUserId: partner.id });
    }
    endCallCleanup();
    onClose();
  };

  useEffect(() => {
    // Only caller starts media immediately
    if (!isIncoming) {
      initOutgoingCall();
    }

    if (socket) {
      // Caller receives call_accepted
      socket.on('call_accepted', async ({ signal }) => {
        const pc = peerConnectionRef.current;
        if (pc && pc.signalingState !== 'closed') {
          try {
            await pc.setRemoteDescription(new RTCSessionDescription(signal));
            await flushIceCandidates(pc);
            setCallStatus('connected');
            startTimer();
          } catch (e) {
            console.error('Set remote description error:', e);
          }
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
          const pc = peerConnectionRef.current;
          if (pc && pc.remoteDescription && pc.remoteDescription.type) {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
          } else {
            iceCandidatesQueueRef.current.push(candidate);
          }
        } catch (e) {
          console.warn('Incoming ICE candidate error:', e);
        }
      });
    }

    return () => {
      if (socket) {
        socket.off('call_accepted');
        socket.off('call_rejected');
        socket.off('call_ended');
        socket.off('call_ice_candidate');
      }
      endCallCleanup();
    };
  }, []);

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

  const formatDuration = (secs) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const partnerAvatar = partner?.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${partner?.username || 'user'}`;

  return (
    <div className="fixed inset-0 z-50 bg-dark-950 flex flex-col items-center justify-between p-4 sm:p-6 animate-fade-in select-none">
      {/* Hidden audio element to guarantee remote audio playback */}
      <audio ref={remoteAudioRef} autoPlay playsInline />

      {/* Top Header */}
      <div className="w-full max-w-4xl flex items-center justify-between z-10">
        <div className="flex items-center space-x-3">
          <img
            src={partnerAvatar}
            alt={partner?.name}
            className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl border border-slate-700 object-cover bg-slate-800"
          />
          <div>
            <h3 className="font-bold text-white text-sm sm:text-base">{partner?.name || 'Friend'}</h3>
            <p className="text-xs text-brand-400 font-mono">@{partner?.username || 'user'}</p>
          </div>
        </div>

        <div className="px-3.5 py-1.5 rounded-full bg-slate-900/90 border border-slate-800 text-xs font-mono font-medium text-slate-300">
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

      {/* Error Banner */}
      {mediaError && (
        <div className="w-full max-w-md my-2 p-3 rounded-2xl bg-red-500/20 border border-red-500/40 text-red-300 text-xs text-center">
          ⚠️ {mediaError}
        </div>
      )}

      {/* --- STAGE 1: INCOMING CALL SCREEN --- */}
      {callStatus === 'incoming' && (
        <div className="flex-1 flex flex-col items-center justify-center space-y-6 animate-scale-up my-auto">
          <div className="relative">
            <span className="absolute -inset-4 rounded-full bg-brand-500/20 animate-ping" />
            <span className="absolute -inset-8 rounded-full bg-brand-500/10 animate-pulse" />
            <img
              src={partnerAvatar}
              alt={partner?.name}
              className="relative w-28 h-28 sm:w-36 sm:h-36 rounded-full border-4 border-brand-500 object-cover shadow-2xl bg-slate-800"
            />
          </div>

          <div className="text-center space-y-1">
            <h2 className="text-xl sm:text-2xl font-bold text-white">{partner?.name || 'Incoming Call'}</h2>
            <p className="text-xs sm:text-sm text-brand-400 font-mono">@{partner?.username}</p>
            <p className="text-xs text-slate-400 pt-2 animate-pulse">
              📞 Incoming {callType === 'video' ? 'Video' : 'Audio'} Call...
            </p>
          </div>

          <div className="flex items-center space-x-6 pt-4">
            <button
              onClick={handleRejectCall}
              className="flex flex-col items-center space-y-2 group cursor-pointer"
            >
              <div className="w-16 h-16 rounded-full bg-red-600 hover:bg-red-500 text-white flex items-center justify-center shadow-xl shadow-red-600/30 transition transform active:scale-90">
                <PhoneOff className="w-7 h-7" />
              </div>
              <span className="text-xs font-semibold text-slate-300 group-hover:text-red-400">Decline</span>
            </button>

            <button
              onClick={handleAcceptCall}
              className="flex flex-col items-center space-y-2 group cursor-pointer"
            >
              <div className="w-16 h-16 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center shadow-xl shadow-emerald-600/30 transition transform active:scale-90 animate-bounce">
                <Phone className="w-7 h-7" />
              </div>
              <span className="text-xs font-semibold text-slate-300 group-hover:text-emerald-400">Accept</span>
            </button>
          </div>
        </div>
      )}

      {/* --- STAGE 2: CALLING / CONNECTING SCREEN --- */}
      {(callStatus === 'calling' || callStatus === 'connecting') && (
        <div className="flex-1 flex flex-col items-center justify-center space-y-6 my-auto">
          <div className="relative">
            <span className="absolute -inset-4 rounded-full bg-brand-500/20 animate-ping" />
            <img
              src={partnerAvatar}
              alt={partner?.name}
              className="relative w-28 h-28 sm:w-36 sm:h-36 rounded-full border-4 border-brand-500/60 object-cover shadow-2xl bg-slate-800"
            />
          </div>

          <div className="text-center space-y-1">
            <h2 className="text-xl sm:text-2xl font-bold text-white">{partner?.name}</h2>
            <p className="text-xs text-brand-400 font-mono">@{partner?.username}</p>
            <p className="text-xs text-slate-400 pt-2 animate-pulse">
              {callStatus === 'connecting' ? 'Establishing secure connection...' : `Calling ${callType === 'video' ? 'Video' : 'Audio'}... Waiting for answer`}
            </p>
          </div>

          <button
            onClick={hangUp}
            className="flex items-center space-x-2 px-6 py-3 bg-red-600 hover:bg-red-500 text-white rounded-2xl text-xs font-bold shadow-xl shadow-red-600/30 transition transform active:scale-95 cursor-pointer mt-4"
          >
            <PhoneOff className="w-4 h-4" />
            <span>Cancel Call</span>
          </button>
        </div>
      )}

      {/* --- STAGE 3: REJECTED / ENDED SCREEN --- */}
      {(callStatus === 'rejected' || callStatus === 'ended') && (
        <div className="flex-1 flex flex-col items-center justify-center space-y-4 my-auto">
          <div className="w-20 h-20 rounded-full bg-red-500/20 border-2 border-red-500 flex items-center justify-center text-red-400">
            <PhoneOff className="w-10 h-10" />
          </div>
          <h2 className="text-lg font-bold text-white">
            {callStatus === 'rejected' ? 'Call Declined' : 'Call Ended'}
          </h2>
          <p className="text-xs text-slate-400">Closing window...</p>
        </div>
      )}

      {/* --- STAGE 4: CONNECTED 2-WAY CALL STAGE --- */}
      {callStatus === 'connected' && (
        <>
          <div className="relative w-full max-w-4xl flex-1 my-3 sm:my-4 bg-dark-900 border border-slate-800 rounded-3xl overflow-hidden flex items-center justify-center shadow-2xl">
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
                <div className="text-slate-300 font-medium text-sm">Audio Call Active</div>
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

          {/* Connected Control Bar */}
          <div className="flex items-center space-x-3 sm:space-x-4 bg-dark-900/90 border border-slate-800 px-4 sm:px-6 py-2.5 sm:py-3 rounded-2xl sm:rounded-3xl shadow-2xl z-10 backdrop-blur">
            <button
              onClick={toggleMic}
              className={`p-3 sm:p-4 rounded-xl sm:rounded-2xl transition shadow-lg cursor-pointer ${
                isMicMuted ? 'bg-red-500/20 text-red-400 border border-red-500/40' : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
              }`}
              title={isMicMuted ? 'Unmute Mic' : 'Mute Mic'}
            >
              {isMicMuted ? <MicOff className="w-5 h-5 sm:w-6 sm:h-6" /> : <Mic className="w-5 h-5 sm:w-6 sm:h-6" />}
            </button>

            {callType === 'video' && (
              <button
                onClick={toggleVideo}
                className={`p-3 sm:p-4 rounded-xl sm:rounded-2xl transition shadow-lg cursor-pointer ${
                  isVideoMuted ? 'bg-red-500/20 text-red-400 border border-red-500/40' : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                }`}
                title={isVideoMuted ? 'Turn Camera On' : 'Turn Camera Off'}
              >
                {isVideoMuted ? <VideoOff className="w-5 h-5 sm:w-6 sm:h-6" /> : <Video className="w-5 h-5 sm:w-6 sm:h-6" />}
              </button>
            )}

            <button
              onClick={hangUp}
              className="p-3 sm:p-4 bg-red-600 hover:bg-red-500 text-white rounded-xl sm:rounded-2xl transition shadow-lg shadow-red-600/40 cursor-pointer active:scale-95"
              title="End Call"
            >
              <PhoneOff className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>
          </div>
        </>
      )}
    </div>
  );
}
