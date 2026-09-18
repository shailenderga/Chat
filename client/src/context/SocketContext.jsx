import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { playNotificationSound, playRingtone } from '../utils/sound';
import { sendDeviceNotification } from '../utils/notifications';

const SocketContext = createContext();

export const useSocket = () => useContext(SocketContext);

export const SocketProvider = ({ children }) => {
  const { user } = useAuth();
  const [socket, setSocket] = useState(null);
  const [incomingCall, setIncomingCall] = useState(null);
  const [activeToast, setActiveToast] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  const [userLastSeen, setUserLastSeen] = useState({}); // userId -> ISO timestamp
  const [typingUsers, setTypingUsers] = useState({}); // conversationId -> { userId, username, timestamp }

  const typingTimeoutRef = useRef({});

  useEffect(() => {
    if (!user) {
      if (socket) {
        socket.disconnect();
        setSocket(null);
      }
      return;
    }

    // Connect to server (supports localhost, 127.0.0.1, custom Vite ports, and cloud origin)
    const isLocalDev = window.location.hostname === 'localhost' ||
                       window.location.hostname === '127.0.0.1' ||
                       window.location.port === '5173' ||
                       window.location.port === '3000';
    const socketUrl = import.meta.env.VITE_API_URL ||
                      (isLocalDev ? `${window.location.protocol}//${window.location.hostname}:5000` : window.location.origin);

    const newSocket = io(socketUrl, {
      transports: ['websocket', 'polling']
    });

    newSocket.on('connect', () => {
      console.log('⚡ Socket connected:', newSocket.id);
      newSocket.emit('register_user', user);
    });

    // 1. Initial Online Users List
    newSocket.on('initial_online_users', (userIds) => {
      if (Array.isArray(userIds)) {
        const idSet = new Set();
        userIds.forEach(id => {
          idSet.add(id);
          idSet.add(Number(id));
          idSet.add(String(id));
        });
        setOnlineUsers(idSet);
      }
    });

    // 2. Real-Time Online / Offline Status & Last Seen
    newSocket.on('user_status_change', ({ userId, status, last_seen }) => {
      setOnlineUsers((prev) => {
        const next = new Set(prev);
        if (status === 'online') {
          next.add(userId);
          next.add(Number(userId));
          next.add(String(userId));
        } else {
          next.delete(userId);
          next.delete(Number(userId));
          next.delete(String(userId));
        }
        return next;
      });

      if (last_seen) {
        setUserLastSeen((prev) => ({
          ...prev,
          [userId]: last_seen,
          [Number(userId)]: last_seen,
          [String(userId)]: last_seen
        }));
      }
    });

    // 3. Real-Time Typing Indicator
    newSocket.on('user_typing', ({ conversationId, userId, username }) => {
      if (userId === user.id) return; // ignore own typing

      setTypingUsers((prev) => ({
        ...prev,
        [conversationId]: { userId, username, timestamp: Date.now() }
      }));

      // Auto-clear typing after 4 seconds if no stop received
      if (typingTimeoutRef.current[conversationId]) {
        clearTimeout(typingTimeoutRef.current[conversationId]);
      }
      typingTimeoutRef.current[conversationId] = setTimeout(() => {
        setTypingUsers((prev) => {
          const next = { ...prev };
          delete next[conversationId];
          return next;
        });
      }, 4000);
    });

    newSocket.on('user_stop_typing', ({ conversationId, userId }) => {
      if (userId === user.id) return;
      if (typingTimeoutRef.current[conversationId]) {
        clearTimeout(typingTimeoutRef.current[conversationId]);
      }
      setTypingUsers((prev) => {
        const next = { ...prev };
        delete next[conversationId];
        return next;
      });
    });

    // 4. Real-Time Incoming Notifications & Direct Device/Phone Notifications
    newSocket.on('incoming_notification', (data) => {
      playNotificationSound();

      // Show in-app toast
      setActiveToast({
        id: Date.now(),
        title: data.title,
        content: data.content,
        type: data.type,
        metadata: data,
        conversationId: data.conversationId
      });

      // Send Direct Device & Phone Push Notification
      sendDeviceNotification({
        title: data.title || 'Wavy Messenger',
        body: data.content || 'You received a new notification',
        tag: `notif_${data.conversationId || Date.now()}`,
        data: { conversationId: data.conversationId }
      });

      // Auto dismiss in-app toast after 5s
      setTimeout(() => {
        setActiveToast((prev) => (prev?.id === data.id ? null : prev));
      }, 5000);
    });

    // 5. Incoming 1-on-1 Call
    newSocket.on('incoming_call', (callData) => {
      playRingtone();
      setIncomingCall(callData);

      const callerName = callData.from?.name || `@${callData.from?.username}` || 'Someone';
      sendDeviceNotification({
        title: `📞 Incoming ${callData.callType === 'video' ? 'Video' : 'Audio'} Call`,
        body: `${callerName} is calling you on Wavy! Tap to answer.`,
        tag: `call_${callData.from?.id || 'incoming'}`,
        data: { conversationId: callData.conversationId }
      });
    });

    newSocket.on('call_ended', () => {
      setIncomingCall(null);
    });

    newSocket.on('call_rejected', () => {
      setIncomingCall(null);
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [user?.id]);

  // Helper: Emit typing start
  const emitTyping = useCallback((conversationId, partnerId) => {
    if (socket && user && conversationId) {
      socket.emit('typing', {
        conversationId,
        userId: user.id,
        username: user.username,
        partnerId
      });
    }
  }, [socket, user]);

  // Helper: Emit typing stop
  const emitStopTyping = useCallback((conversationId, partnerId) => {
    if (socket && user && conversationId) {
      socket.emit('stop_typing', {
        conversationId,
        userId: user.id,
        partnerId
      });
    }
  }, [socket, user]);

  // Heartbeat & Online Status Fallback (ensures online status works in serverless environments)
  useEffect(() => {
    if (!user) return;

    const sendHeartbeat = async () => {
      try {
        const token = localStorage.getItem('wavy_token');
        if (!token) return;
        await fetch('/api/users/heartbeat', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` }
        });
      } catch (e) {}
    };

    const fetchOnlineUsers = async () => {
      try {
        const token = localStorage.getItem('wavy_token');
        if (!token) return;
        const res = await fetch('/api/users/online', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const ids = await res.json();
          if (Array.isArray(ids)) {
            setOnlineUsers((prev) => {
              const combined = new Set(prev);
              ids.forEach(id => {
                combined.add(id);
                combined.add(Number(id));
                combined.add(String(id));
              });
              return combined;
            });
          }
        }
      } catch (e) {}
    };

    sendHeartbeat();
    fetchOnlineUsers();

    const heartbeatInterval = setInterval(sendHeartbeat, 15000);
    const onlineInterval = setInterval(fetchOnlineUsers, 8000);

    return () => {
      clearInterval(heartbeatInterval);
      clearInterval(onlineInterval);
    };
  }, [user]);

  const clearToast = () => setActiveToast(null);

  return (
    <SocketContext.Provider value={{
      socket,
      incomingCall,
      setIncomingCall,
      activeToast,
      clearToast,
      onlineUsers,
      userLastSeen,
      typingUsers,
      emitTyping,
      emitStopTyping
    }}>
      {children}
    </SocketContext.Provider>
  );
};
