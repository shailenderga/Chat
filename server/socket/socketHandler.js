const db = require('../config/db');

module.exports = (io) => {
  // Map of userId -> Set of socket IDs
  const userSocketMap = new Map();
  // Map of socketId -> User info
  const socketUserMap = new Map();
  // Meeting rooms tracking: roomId -> Map(userId -> { socketId, user, isHandRaised, isMuted, isVideoOff })
  const meetingRooms = new Map();

  io.on('connection', (socket) => {
    // 1. Authenticate / Register User Socket
    socket.on('register_user', async (user) => {
      if (!user || !user.id) return;
      const userId = user.id;

      if (!userSocketMap.has(userId)) {
        userSocketMap.set(userId, new Set());
      }
      userSocketMap.get(userId).add(socket.id);
      socketUserMap.set(socket.id, user);

      // Join personal room for private notifications
      socket.join(`user_${userId}`);

      if (user.role === 'admin') {
        socket.join('admin_channel');
      }

      // Update online status in DB
      await db.query('UPDATE users SET status = "online", last_seen = CURRENT_TIMESTAMP WHERE id = ?', [userId]);

      // Send initial list of currently online users to this socket
      socket.emit('initial_online_users', Array.from(userSocketMap.keys()));

      // Broadcast user online status to all other users
      socket.broadcast.emit('user_status_change', { userId, status: 'online', last_seen: null });
    });

    // 2. Join Conversation Room
    socket.on('join_conversation', (conversationId) => {
      socket.join(`convo_${conversationId}`);
    });

    socket.on('leave_conversation', (conversationId) => {
      socket.leave(`convo_${conversationId}`);
    });

    // 3. Real-Time Chat Message
    socket.on('send_message', async (data) => {
      const { conversationId, message, partnerId, streakCount } = data;

      // Broadcast to room
      socket.to(`convo_${conversationId}`).emit('new_message', { conversationId, message, streakCount });

      // If partner is not currently looking at the chat room, notify them directly
      if (partnerId) {
        io.to(`user_${partnerId}`).emit('incoming_notification', {
          type: 'message',
          title: `New message from @${message.sender_username}`,
          content: message.content || (message.message_type === 'voice_note' ? '🎤 Voice note' : 'Attachment'),
          conversationId,
          message
        });
      }

      // Live Admin Chat Spy: Broadcast to admin_channel
      io.to('admin_channel').emit('admin_live_message', {
        conversationId,
        message
      });
    });

    // Real-Time Message Deletion
    socket.on('delete_message', ({ messageId, conversationId, deleteType }) => {
      io.to(`convo_${conversationId}`).emit('message_deleted', { messageId, conversationId, deleteType });
    });

    // 4. Typing Indicator (Real-Time Current Time)
    socket.on('typing', ({ conversationId, userId, username, partnerId }) => {
      socket.to(`convo_${conversationId}`).emit('user_typing', { conversationId, userId, username });
      if (partnerId) {
        io.to(`user_${partnerId}`).emit('user_typing', { conversationId, userId, username });
      }
    });

    socket.on('stop_typing', ({ conversationId, userId, partnerId }) => {
      socket.to(`convo_${conversationId}`).emit('user_stop_typing', { conversationId, userId });
      if (partnerId) {
        io.to(`user_${partnerId}`).emit('user_stop_typing', { conversationId, userId });
      }
    });

    // 5. 1-on-1 Call Signaling (WebRTC)
    socket.on('call_user', ({ toUserId, signalData, callType, fromUser, conversationId }) => {
      io.to(`user_${toUserId}`).emit('incoming_call', {
        signal: signalData,
        from: fromUser,
        callType, // 'audio' or 'video'
        conversationId
      });
    });

    socket.on('answer_call', ({ toUserId, signalData }) => {
      io.to(`user_${toUserId}`).emit('call_accepted', { signal: signalData });
    });

    socket.on('reject_call', ({ toUserId }) => {
      io.to(`user_${toUserId}`).emit('call_rejected');
    });

    socket.on('end_call', ({ toUserId }) => {
      io.to(`user_${toUserId}`).emit('call_ended');
    });

    socket.on('call_ice_candidate', ({ toUserId, candidate }) => {
      io.to(`user_${toUserId}`).emit('call_ice_candidate', { candidate });
    });

    // 6. Zoom-Style Meeting Rooms
    socket.on('join_meeting_room', ({ roomId, user }) => {
      socket.join(`meeting_${roomId}`);

      if (!meetingRooms.has(roomId)) {
        meetingRooms.set(roomId, new Map());
      }
      const roomUsers = meetingRooms.get(roomId);
      roomUsers.set(user.id, { socketId: socket.id, user, isMuted: false, isVideoOff: false, isHandRaised: false });

      // Send existing participants to newly joined user
      const participants = Array.from(roomUsers.values()).map(p => ({
        ...p.user,
        socketId: p.socketId,
        isMuted: p.isMuted,
        isVideoOff: p.isVideoOff,
        isHandRaised: p.isHandRaised
      }));

      socket.emit('meeting_current_participants', participants);

      // Notify others in meeting
      socket.to(`meeting_${roomId}`).emit('participant_joined', {
        ...user,
        socketId: socket.id,
        isMuted: false,
        isVideoOff: false,
        isHandRaised: false
      });
    });

    // Host admission control / waiting room
    socket.on('request_meeting_admission', ({ roomId, hostId, user }) => {
      io.to(`user_${hostId}`).emit('guest_requesting_admission', { roomId, user, socketId: socket.id });
    });

    socket.on('host_admit_guest', ({ guestSocketId, roomId }) => {
      io.to(guestSocketId).emit('admission_granted', { roomId });
    });

    socket.on('host_deny_guest', ({ guestSocketId }) => {
      io.to(guestSocketId).emit('admission_denied');
    });

    // Meeting WebRTC Peer Signaling
    socket.on('meeting_signal', ({ toSocketId, signal, fromUser }) => {
      io.to(toSocketId).emit('meeting_signal', {
        signal,
        fromSocketId: socket.id,
        fromUser
      });
    });

    socket.on('meeting_state_change', ({ roomId, userId, isMuted, isVideoOff, isHandRaised, isScreenSharing }) => {
      socket.to(`meeting_${roomId}`).emit('participant_state_updated', {
        userId,
        socketId: socket.id,
        isMuted,
        isVideoOff,
        isHandRaised,
        isScreenSharing
      });
    });

    socket.on('meeting_chat_message', ({ roomId, message }) => {
      io.to(`meeting_${roomId}`).emit('meeting_chat_message', message);
    });

    socket.on('leave_meeting_room', ({ roomId, userId }) => {
      socket.leave(`meeting_${roomId}`);
      if (meetingRooms.has(roomId)) {
        const roomUsers = meetingRooms.get(roomId);
        roomUsers.delete(userId);
        if (roomUsers.size === 0) {
          meetingRooms.delete(roomId);
        }
      }
      socket.to(`meeting_${roomId}`).emit('participant_left', { userId, socketId: socket.id });
    });

    // 7. Disconnect Handler
    socket.on('disconnect', async () => {
      const user = socketUserMap.get(socket.id);
      socketUserMap.delete(socket.id);

      if (user && user.id) {
        const sockets = userSocketMap.get(user.id);
        if (sockets) {
          sockets.delete(socket.id);
          if (sockets.size === 0) {
            userSocketMap.delete(user.id);
            // Update offline in DB
            const lastSeenIso = new Date().toISOString();
            await db.query('UPDATE users SET status = "offline", last_seen = CURRENT_TIMESTAMP WHERE id = ?', [user.id]);
            io.emit('user_status_change', { userId: user.id, status: 'offline', last_seen: lastSeenIso });
          }
        }
      }

      // Remove from any meeting rooms
      meetingRooms.forEach((roomUsers, roomId) => {
        for (const [uid, p] of roomUsers.entries()) {
          if (p.socketId === socket.id) {
            roomUsers.delete(uid);
            socket.to(`meeting_${roomId}`).emit('participant_left', { userId: uid, socketId: socket.id });
            break;
          }
        }
      });
    });
  });
};
