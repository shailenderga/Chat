const db = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Get overall platform statistics
exports.getSystemStats = async (req, res) => {
  try {
    const [users] = await db.query('SELECT COUNT(*) as totalUsers FROM users');
    const [convos] = await db.query('SELECT COUNT(*) as totalConvos FROM conversations');
    const [msgs] = await db.query('SELECT COUNT(*) as totalMsgs FROM messages');
    const [meetings] = await db.query('SELECT COUNT(*) as activeMeetings FROM meeting_rooms WHERE is_active = TRUE');
    const [banned] = await db.query('SELECT COUNT(*) as bannedUsers FROM users WHERE is_banned = TRUE');

    res.json({
      totalUsers: users[0]?.totalUsers || 0,
      totalConversations: convos[0]?.totalConvos || 0,
      totalMessages: msgs[0]?.totalMsgs || 0,
      activeMeetings: meetings[0]?.activeMeetings || 0,
      bannedUsers: banned[0]?.bannedUsers || 0
    });
  } catch (error) {
    console.error('Admin stats error:', error);
    res.status(500).json({ message: 'Server error: ' + error.message });
  }
};

// List all registered users
exports.getAllUsers = async (req, res) => {
  try {
    const [users] = await db.query(
      `SELECT id, username, name, email, role, avatar, bio, is_banned, status, last_seen, created_at 
       FROM users 
       ORDER BY created_at DESC`
    );
    res.json(users || []);
  } catch (error) {
    console.error('Admin get users error:', error);
    res.status(500).json({ message: 'Server error: ' + error.message });
  }
};

// Ban / Unban a user
exports.toggleBanUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { isBanned } = req.body;

    // Prevent banning super admin
    const [target] = await db.query('SELECT role FROM users WHERE id = ?', [userId]);
    if (target?.[0]?.role === 'admin') {
      return res.status(400).json({ message: 'Cannot ban an Administrator account' });
    }

    await db.query('UPDATE users SET is_banned = ? WHERE id = ?', [Boolean(isBanned), userId]);

    res.json({
      message: `User account has been ${isBanned ? 'banned' : 'unbanned'} successfully`,
      isBanned: Boolean(isBanned)
    });
  } catch (error) {
    console.error('Admin toggle ban error:', error);
    res.status(500).json({ message: 'Server error: ' + error.message });
  }
};

// Delete user account
exports.deleteUser = async (req, res) => {
  try {
    const { userId } = req.params;

    const [target] = await db.query('SELECT role FROM users WHERE id = ?', [userId]);
    if (target?.[0]?.role === 'admin') {
      return res.status(400).json({ message: 'Cannot delete an Administrator account' });
    }

    await db.query('DELETE FROM users WHERE id = ?', [userId]);
    res.json({ message: 'User account deleted permanently' });
  } catch (error) {
    console.error('Admin delete user error:', error);
    res.status(500).json({ message: 'Server error: ' + error.message });
  }
};

// Admin Chat Monitor: List all conversations across the entire platform
exports.getAllConversations = async (req, res) => {
  try {
    const [convos] = await db.query(
      `SELECT c.*, 
              u1.id as u1_id, u1.name as u1_name, u1.username as u1_username, u1.avatar as u1_avatar, u1.email as u1_email,
              u2.id as u2_id, u2.name as u2_name, u2.username as u2_username, u2.avatar as u2_avatar, u2.email as u2_email
       FROM conversations c
       JOIN users u1 ON c.user1_id = u1.id
       JOIN users u2 ON c.user2_id = u2.id
       ORDER BY c.last_message_time DESC`
    );

    const detailedConvos = await Promise.all((convos || []).map(async (c) => {
      // Get message count and last message
      const [msgCount] = await db.query('SELECT COUNT(*) as cnt FROM messages WHERE conversation_id = ?', [c.id]);
      const [lastMsg] = await db.query(
        'SELECT sender_id, message_type, content, created_at FROM messages WHERE conversation_id = ? ORDER BY created_at DESC LIMIT 1',
        [c.id]
      );

      return {
        id: c.id,
        user1: { id: c.u1_id, name: c.u1_name, username: c.u1_username, avatar: c.u1_avatar, email: c.u1_email },
        user2: { id: c.u2_id, name: c.u2_name, username: c.u2_username, avatar: c.u2_avatar, email: c.u2_email },
        streakCount: c.streak_count,
        totalMessages: msgCount[0]?.cnt || 0,
        lastMessage: lastMsg?.[0] || null,
        lastMessageTime: c.last_message_time,
        createdAt: c.created_at
      };
    }));

    res.json(detailedConvos);
  } catch (error) {
    console.error('Admin get conversations error:', error);
    res.status(500).json({ message: 'Server error: ' + error.message });
  }
};

// Admin Chat Monitor: View all messages in any conversation
exports.getConversationMessages = async (req, res) => {
  try {
    const { conversationId } = req.params;

    const [messages] = await db.query(
      `SELECT m.*, u.name as sender_name, u.username as sender_username, u.avatar as sender_avatar, u.email as sender_email
       FROM messages m
       JOIN users u ON m.sender_id = u.id
       WHERE m.conversation_id = ?
       ORDER BY m.created_at ASC`,
      [conversationId]
    );

    res.json(messages || []);
  } catch (error) {
    console.error('Admin get conversation messages error:', error);
    res.status(500).json({ message: 'Server error: ' + error.message });
  }
};

// Admin: Reset password for any user directly
exports.resetUserPassword = async (req, res) => {
  try {
    const { userId } = req.params;
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters long' });
    }

    const [target] = await db.query('SELECT id, username, email FROM users WHERE id = ?', [userId]);
    if (!target || target.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await db.query(
      'UPDATE users SET password_hash = ?, reset_code = NULL, reset_expires = NULL WHERE id = ?',
      [passwordHash, userId]
    );

    res.json({
      message: `Password for @${target[0].username} has been updated successfully`,
      userId: target[0].id
    });
  } catch (error) {
    console.error('Admin reset password error:', error);
    res.status(500).json({ message: 'Server error resetting password: ' + error.message });
  }
};

// Admin: Create a new user account directly from Admin Dashboard
exports.createUserByAdmin = async (req, res) => {
  try {
    const { name, username, email, password, role } = req.body;

    if (!name || !username || !email || !password) {
      return res.status(400).json({ message: 'Name, username, email, and password are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters long' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanUsername = username.trim().toLowerCase().replace(/[^a-z0-9_.]/g, '');

    // Check duplicate
    const [existing] = await db.query(
      'SELECT id, email, username FROM users WHERE email = ? OR username = ?',
      [cleanEmail, cleanUsername]
    );
    if (existing && existing.length > 0) {
      return res.status(400).json({ message: 'An account with this email or username already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const defaultAvatar = `https://api.dicebear.com/7.x/bottts/svg?seed=${cleanUsername}`;

    const [result] = await db.query(
      'INSERT INTO users (username, name, email, password_hash, avatar, bio, role) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [cleanUsername, name.trim(), cleanEmail, passwordHash, defaultAvatar, 'Hey there! I am using Wavy', role || 'user']
    );

    res.status(201).json({
      message: `Account @${cleanUsername} created successfully`,
      user: {
        id: result.insertId,
        username: cleanUsername,
        name: name.trim(),
        email: cleanEmail,
        role: role || 'user',
        avatar: defaultAvatar
      }
    });
  } catch (error) {
    console.error('Admin create user error:', error);
    res.status(500).json({ message: 'Server error creating user: ' + error.message });
  }
};

// Admin: Impersonate / One-click Login As User
exports.impersonateUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const [target] = await db.query('SELECT * FROM users WHERE id = ?', [userId]);
    if (!target || target.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const targetUser = target[0];
    const token = jwt.sign(
      { id: targetUser.id, username: targetUser.username, email: targetUser.email, role: targetUser.role },
      process.env.JWT_SECRET || 'super_secret_jwt_chat_app_key_2026',
      { expiresIn: '30d' }
    );

    res.json({
      message: `Logged in as @${targetUser.username}`,
      user: {
        id: targetUser.id,
        username: targetUser.username,
        name: targetUser.name,
        email: targetUser.email,
        role: targetUser.role,
        avatar: targetUser.avatar,
        bio: targetUser.bio
      },
      token
    });
  } catch (error) {
    console.error('Admin impersonate error:', error);
    res.status(500).json({ message: 'Server error: ' + error.message });
  }
};
