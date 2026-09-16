const db = require('../config/db');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const os = require('os');

// Ensure uploads folder exists (use /tmp on Vercel serverless)
const uploadDir = process.env.VERCEL ? path.join(os.tmpdir(), 'uploads') : path.join(__dirname, '..', 'uploads');
try {
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
} catch (e) {
  console.warn('Upload directory check warning:', e.message);
}

// Multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    let ext = path.extname(file.originalname);
    if (!ext || ext.toLowerCase() === '.bin') {
      const mime = (file.mimetype || '').toLowerCase();
      if (mime.includes('webm')) ext = '.webm';
      else if (mime.includes('mp4')) ext = '.mp4';
      else if (mime.includes('ogg')) ext = '.ogg';
      else if (mime.includes('wav')) ext = '.wav';
      else if (mime.includes('mpeg') || mime.includes('mp3')) ext = '.mp3';
      else if (mime.includes('png')) ext = '.png';
      else if (mime.includes('jpeg') || mime.includes('jpg')) ext = '.jpg';
      else ext = '.webm'; // default audio/video recording fallback
    }
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB max limit
});

exports.uploadMiddleware = upload.single('file');

// Upload Media Endpoint
exports.uploadMedia = (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }
    const fileUrl = `/uploads/${req.file.filename}`;
    res.json({
      fileUrl,
      url: fileUrl,
      fileName: req.file.originalname,
      fileSize: req.file.size,
      mimeType: req.file.mimetype
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ message: 'Upload failed: ' + error.message });
  }
};

// Helper: Convert any date to local YYYY-MM-DD string
function toDateOnlyString(val) {
  if (!val) return null;
  if (typeof val === 'string') {
    const match = val.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) return `${match[1]}-${match[2]}-${match[3]}`;
  }
  const d = new Date(val);
  if (isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Helper: Calculate difference in calendar days between two YYYY-MM-DD strings
function getCalendarDaysDiff(dateStr1, dateStr2) {
  if (!dateStr1 || !dateStr2) return null;
  const [y1, m1, d1] = dateStr1.split('-').map(Number);
  const [y2, m2, d2] = dateStr2.split('-').map(Number);
  const utc1 = Date.UTC(y1, m1 - 1, d1);
  const utc2 = Date.UTC(y2, m2 - 1, d2);
  return Math.round((utc2 - utc1) / (1000 * 60 * 60 * 24));
}

// Helper: Calculate streak status
function calculateStreak(convo) {
  const now = new Date();
  let streakCount = Number(convo.streak_count) || 0;
  const lastMsgTime = convo.last_message_time ? new Date(convo.last_message_time) : null;
  let isExpiringSoon = false;
  let hoursRemaining = 24;

  if (!lastMsgTime || streakCount === 0) {
    return { streakCount: 0, isExpiringSoon: false, hoursRemaining: 0 };
  }

  const diffHours = (now - lastMsgTime) / (1000 * 60 * 60);

  // If 24 hours have passed without any message, the streak resets to 0!
  if (diffHours >= 24) {
    return { streakCount: 0, isExpiringSoon: false, hoursRemaining: 0 };
  }

  // If less than 4 hours remaining (i.e. between 20 and 24 hours since last message)
  hoursRemaining = Math.max(1, Math.round(24 - diffHours));
  if (diffHours >= 20) {
    isExpiringSoon = true;
  }

  return {
    streakCount,
    isExpiringSoon,
    hoursRemaining
  };
}

// Get all active conversations for the current user
exports.getConversations = async (req, res) => {
  try {
    const userId = req.user.id;

    const [convos] = await db.query(
      `SELECT c.*, 
              u1.id as u1_id, u1.name as u1_name, u1.username as u1_username, u1.avatar as u1_avatar, u1.bio as u1_bio, u1.created_at as u1_created_at, u1.status as u1_status, u1.last_seen as u1_last_seen, u1.last_seen_privacy as u1_last_seen_privacy,
              u2.id as u2_id, u2.name as u2_name, u2.username as u2_username, u2.avatar as u2_avatar, u2.bio as u2_bio, u2.created_at as u2_created_at, u2.status as u2_status, u2.last_seen as u2_last_seen, u2.last_seen_privacy as u2_last_seen_privacy
       FROM conversations c
       JOIN users u1 ON c.user1_id = u1.id
       JOIN users u2 ON c.user2_id = u2.id
       WHERE c.user1_id = ? OR c.user2_id = ?
       ORDER BY c.last_message_time DESC`,
      [userId, userId]
    );

    const formattedList = await Promise.all((convos || []).map(async (c) => {
      const isU1 = c.user1_id === userId;
      const partner = isU1 ? {
        id: c.u2_id,
        name: c.u2_name,
        username: c.u2_username,
        avatar: c.u2_avatar,
        bio: c.u2_bio || 'Hey there! I am using Wavy.',
        created_at: c.u2_created_at,
        status: c.u2_status,
        last_seen: c.u2_last_seen,
        last_seen_privacy: c.u2_last_seen_privacy || 'everyone'
      } : {
        id: c.u1_id,
        name: c.u1_name,
        username: c.u1_username,
        avatar: c.u1_avatar,
        bio: c.u1_bio || 'Hey there! I am using Wavy.',
        created_at: c.u1_created_at,
        status: c.u1_status,
        last_seen: c.u1_last_seen,
        last_seen_privacy: c.u1_last_seen_privacy || 'everyone'
      };

      // Get last message
      const [lastMsgs] = await db.query(
        'SELECT id, sender_id, message_type, content, file_url, status, created_at FROM messages WHERE conversation_id = ? ORDER BY created_at DESC LIMIT 1',
        [c.id]
      );

      // Streak check
      const streakInfo = calculateStreak(c);

      // Check mutual call permission
      const [myPerm] = await db.query(
        'SELECT audio_allowed, video_allowed FROM call_permissions WHERE user_id = ? AND target_user_id = ?',
        [userId, partner.id]
      );
      const [theirPerm] = await db.query(
        'SELECT audio_allowed, video_allowed FROM call_permissions WHERE user_id = ? AND target_user_id = ?',
        [partner.id, userId]
      );

      const mutualAudioAllowed = Boolean(myPerm?.[0]?.audio_allowed && theirPerm?.[0]?.audio_allowed);
      const mutualVideoAllowed = Boolean(myPerm?.[0]?.video_allowed && theirPerm?.[0]?.video_allowed);

      return {
        id: c.id,
        partner,
        lastMessage: lastMsgs?.[0] || null,
        streakCount: streakInfo.streakCount,
        isExpiringSoon: streakInfo.isExpiringSoon,
        hoursRemaining: streakInfo.hoursRemaining,
        mutualAudioAllowed,
        mutualVideoAllowed,
        createdAt: c.created_at,
        lastMessageTime: c.last_message_time
      };
    }));

    res.json(formattedList);
  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({ message: 'Server error: ' + error.message });
  }
};

// Get messages for a specific conversation
exports.getMessages = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user.id;

    // Verify participant
    const [convos] = await db.query('SELECT * FROM conversations WHERE id = ?', [conversationId]);
    if (!convos || convos.length === 0) {
      return res.status(404).json({ message: 'Conversation not found' });
    }

    const convo = convos[0];
    if (convo.user1_id !== userId && convo.user2_id !== userId && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied: not a member of this chat' });
    }

    // Mark incoming messages as read
    try {
      await db.query(
        "UPDATE messages SET status = 'read' WHERE conversation_id = ? AND sender_id != ? AND status != 'read'",
        [conversationId, userId]
      );
    } catch (e) {
      console.warn('Auto mark read warning:', e.message);
    }

    const [messages] = await db.query(
      `SELECT m.*, u.name as sender_name, u.username as sender_username, u.avatar as sender_avatar
       FROM messages m
       JOIN users u ON m.sender_id = u.id
       WHERE m.conversation_id = ?
       ORDER BY m.created_at ASC`,
      [conversationId]
    );

    // Filter out messages deleted for this user or deleted for everyone
    const filtered = (messages || []).filter(m => {
      if (m.is_deleted_for_everyone) return false;
      if (m.deleted_for_users) {
        try {
          const userIds = typeof m.deleted_for_users === 'string' ? JSON.parse(m.deleted_for_users) : m.deleted_for_users;
          if (Array.isArray(userIds) && userIds.map(Number).includes(Number(userId))) {
            return false;
          }
        } catch (e) {}
      }
      return true;
    });

    res.json(filtered);
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ message: 'Server error: ' + error.message });
  }
};

// Send Message
exports.sendMessage = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user.id;
    const { messageType = 'text', content, fileUrl, duration = 0, isEphemeral = false, expiresAt = null } = req.body;

    const [convos] = await db.query('SELECT * FROM conversations WHERE id = ?', [conversationId]);
    if (!convos || convos.length === 0) {
      return res.status(404).json({ message: 'Conversation not found' });
    }

    const convo = convos[0];
    if (convo.user1_id !== userId && convo.user2_id !== userId) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    const partnerId = convo.user1_id === userId ? convo.user2_id : convo.user1_id;

    // Check if partner is currently online to set initial status
    let initialStatus = 'sent';
    try {
      const [partnerRows] = await db.query('SELECT status FROM users WHERE id = ?', [partnerId]);
      if (partnerRows?.[0]?.status === 'online') {
        initialStatus = 'delivered';
      }
    } catch (e) {}

    // Insert Message
    const [msgResult] = await db.query(
      `INSERT INTO messages (conversation_id, sender_id, message_type, content, file_url, duration, is_ephemeral, expires_at, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [conversationId, userId, messageType, content || '', fileUrl || null, duration, isEphemeral, expiresAt, initialStatus]
    );

    const newMsgId = msgResult.insertId;

    // --- Snapchat Daily Streak (Consecutive Days, NOT chat count) ---
    const now = new Date();
    const todayStr = toDateOnlyString(now);
    let streak = Number(convo.streak_count) || 0;
    const lastStreakDate = toDateOnlyString(convo.last_streak_date);
    const lastMsgTime = convo.last_message_time ? new Date(convo.last_message_time) : null;

    if (!lastStreakDate || streak === 0 || !lastMsgTime) {
      // First day starting the streak
      streak = 1;
    } else {
      const dayDiff = getCalendarDaysDiff(lastStreakDate, todayStr);
      const hoursSinceLast = (now - lastMsgTime) / (1000 * 60 * 60);

      if (dayDiff === 0) {
        // SAME CALENDAR DAY: Users already chatted today!
        // DO NOT increment streak on the same day. Streak strictly counts consecutive days!
        streak = Math.max(1, streak);
      } else if (dayDiff === 1 && hoursSinceLast <= 36) {
        // EXACTLY NEXT CONSECUTIVE DAY (e.g. Day 1 -> Day 2 -> Day 3)
        streak = streak + 1;
      } else {
        // Missed a day or gap > 24-36 hours: streak broke, restarts at Day 1!
        streak = 1;
      }
    }

    // Update conversation with daily streak count and date
    await db.query(
      'UPDATE conversations SET streak_count = ?, last_streak_date = ?, last_message_time = CURRENT_TIMESTAMP WHERE id = ?',
      [streak, todayStr, conversationId]
    );

    // Fetch full created message object
    const [createdMsg] = await db.query(
      `SELECT m.*, u.name as sender_name, u.username as sender_username, u.avatar as sender_avatar
       FROM messages m
       JOIN users u ON m.sender_id = u.id
       WHERE m.id = ?`,
      [newMsgId]
    );

    const messageData = createdMsg[0];

    // Trigger Notification for the partner
    let previewText = content || 'Sent an attachment';
    if (messageType === 'voice_note') previewText = '🎤 Voice note';
    if (messageType === 'image') previewText = '📷 Photo';
    if (messageType === 'video') previewText = '🎥 Video';
    if (messageType === 'meeting_invite') previewText = '📹 Video Meeting Invite';

    await db.query(
      'INSERT INTO notifications (user_id, type, title, content, metadata) VALUES (?, ?, ?, ?, ?)',
      [
        partnerId,
        'message',
        `New message from @${req.user.username}`,
        previewText,
        JSON.stringify({ conversationId, messageId: newMsgId, senderId: userId })
      ]
    );

    res.status(201).json({
      message: messageData,
      streakCount: streak
    });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ message: 'Server error: ' + error.message });
  }
};

// React to a message
exports.addReaction = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { emoji } = req.body;
    const userId = req.user.id;

    const [rows] = await db.query('SELECT reactions FROM messages WHERE id = ?', [messageId]);
    if (!rows || rows.length === 0) {
      return res.status(404).json({ message: 'Message not found' });
    }

    let reactions = {};
    if (rows[0].reactions) {
      try {
        reactions = typeof rows[0].reactions === 'string' ? JSON.parse(rows[0].reactions) : rows[0].reactions;
      } catch (e) {
        reactions = {};
      }
    }

    // Toggle reaction for current user
    if (!reactions[emoji]) reactions[emoji] = [];
    if (reactions[emoji].includes(userId)) {
      reactions[emoji] = reactions[emoji].filter(id => id !== userId);
      if (reactions[emoji].length === 0) delete reactions[emoji];
    } else {
      reactions[emoji].push(userId);
    }

    await db.query('UPDATE messages SET reactions = ? WHERE id = ?', [JSON.stringify(reactions), messageId]);

    res.json({ messageId, reactions });
  } catch (error) {
    console.error('Reaction error:', error);
    res.status(500).json({ message: 'Server error: ' + error.message });
  }
};

// Delete message: "for_me" or "for_everyone"
exports.deleteMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { deleteType = 'for_everyone' } = req.body;
    const userId = req.user.id;

    const [msgs] = await db.query('SELECT * FROM messages WHERE id = ?', [messageId]);
    if (!msgs || msgs.length === 0) {
      return res.status(404).json({ message: 'Message not found' });
    }

    const msg = msgs[0];
    const [convos] = await db.query('SELECT * FROM conversations WHERE id = ?', [msg.conversation_id]);
    const convo = convos?.[0];
    if (!convo || (convo.user1_id !== userId && convo.user2_id !== userId && req.user.role !== 'admin')) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    if (deleteType === 'for_everyone') {
      if (msg.sender_id !== userId && req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Only the sender can delete this message for everyone' });
      }

      await db.query(
        'UPDATE messages SET is_deleted_for_everyone = TRUE, content = ?, file_url = NULL WHERE id = ?',
        ['🚫 This message was deleted', messageId]
      );

      // Clean up uploaded file if present
      if (msg.file_url && msg.file_url.startsWith('/uploads/')) {
        const filePath = path.join(__dirname, '..', msg.file_url);
        if (fs.existsSync(filePath)) {
          try { fs.unlinkSync(filePath); } catch (e) {}
        }
      }

      return res.json({
        message: 'Message deleted for everyone',
        messageId: Number(messageId),
        conversationId: msg.conversation_id,
        deleteType: 'for_everyone'
      });
    } else {
      // Delete for me
      let deletedUsers = [];
      try {
        deletedUsers = typeof msg.deleted_for_users === 'string' ? JSON.parse(msg.deleted_for_users) : (msg.deleted_for_users || []);
      } catch (e) {
        deletedUsers = [];
      }
      if (!deletedUsers.map(Number).includes(Number(userId))) {
        deletedUsers.push(userId);
      }

      await db.query(
        'UPDATE messages SET deleted_for_users = ? WHERE id = ?',
        [JSON.stringify(deletedUsers), messageId]
      );

      return res.json({
        message: 'Message deleted for you',
        messageId: Number(messageId),
        conversationId: msg.conversation_id,
        deleteType: 'for_me'
      });
    }
  } catch (error) {
    console.error('Delete message error:', error);
    res.status(500).json({ message: 'Server error: ' + error.message });
  }
};

// Explicitly mark all unread incoming messages in a conversation as read
exports.markMessagesRead = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user.id;

    await db.query(
      "UPDATE messages SET status = 'read' WHERE conversation_id = ? AND sender_id != ? AND status != 'read'",
      [conversationId, userId]
    );

    res.json({ success: true, conversationId });
  } catch (error) {
    console.error('Mark read error:', error);
    res.status(500).json({ message: 'Server error: ' + error.message });
  }
};

