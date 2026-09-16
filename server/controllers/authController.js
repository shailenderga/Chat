const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');

const generateToken = (user) => {
  return jwt.sign(
    { id: user.id, username: user.username, email: user.email, role: user.role },
    process.env.JWT_SECRET || 'super_secret_jwt_chat_app_key_2026',
    { expiresIn: '30d' }
  );
};

// Check username availability
exports.checkUsername = async (req, res) => {
  try {
    const { username } = req.params;
    if (!username || username.trim().length < 3) {
      return res.status(400).json({ available: false, message: 'Username must be at least 3 characters' });
    }

    const cleanUsername = username.trim().toLowerCase();
    const [rows] = await db.query('SELECT id FROM users WHERE username = ?', [cleanUsername]);
    if (rows && rows.length > 0) {
      return res.json({ available: false, message: 'Username is already taken' });
    }

    return res.json({ available: true, message: 'Username is available' });
  } catch (error) {
    console.error('Check username error:', error);
    res.status(500).json({ message: 'Server error checking username' });
  }
};

// Register
exports.register = async (req, res) => {
  try {
    const { name, username, email, password, avatar, bio } = req.body;

    if (!name || !username || !email || !password) {
      return res.status(400).json({ message: 'Please provide all required fields: name, username, email, and password' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanUsername = username.trim().toLowerCase().replace(/[^a-z0-9_.]/g, '');

    if (cleanUsername.length < 3) {
      return res.status(400).json({ message: 'Username must be at least 3 characters long (letters, numbers, underscores)' });
    }

    // Check duplicate email
    const [existingEmail] = await db.query('SELECT id FROM users WHERE email = ?', [cleanEmail]);
    if (existingEmail && existingEmail.length > 0) {
      return res.status(400).json({ message: 'An account with this email already exists' });
    }

    // Check duplicate username
    const [existingUsername] = await db.query('SELECT id FROM users WHERE username = ?', [cleanUsername]);
    if (existingUsername && existingUsername.length > 0) {
      return res.status(400).json({ message: `The username @${cleanUsername} is already taken. Please choose another` });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const defaultAvatar = avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${cleanUsername}`;
    const userBio = bio || 'Hey there! I am using ChatApp';

    const [result] = await db.query(
      'INSERT INTO users (username, name, email, password_hash, avatar, bio, role) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [cleanUsername, name.trim(), cleanEmail, passwordHash, defaultAvatar, userBio, 'user']
    );

    const newUserId = result.insertId;
    const user = {
      id: newUserId,
      username: cleanUsername,
      name: name.trim(),
      email: cleanEmail,
      role: 'user',
      avatar: defaultAvatar,
      bio: userBio,
      is_banned: false,
      status: 'online'
    };

    const token = generateToken(user);
    res.status(201).json({
      message: 'Account created successfully',
      user,
      token
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ message: 'Server error during registration: ' + error.message });
  }
};

// Login with Email + Password
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Please enter your email and password' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const [users] = await db.query('SELECT * FROM users WHERE email = ?', [cleanEmail]);

    if (!users || users.length === 0) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const user = users[0];

    if (user.is_banned) {
      return res.status(403).json({ message: 'This account has been banned by the Administrator.' });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Update status to online
    await db.query('UPDATE users SET status = "online", last_seen = CURRENT_TIMESTAMP WHERE id = ?', [user.id]);

    const token = generateToken(user);

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
        bio: user.bio,
        status: 'online',
        last_seen_privacy: user.last_seen_privacy || 'everyone',
        story_privacy: user.story_privacy || 'everyone',
        chat_wallpaper: user.chat_wallpaper || 'default'
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error during login: ' + error.message });
  }
};

// Current logged-in user
exports.getMe = async (req, res) => {
  try {
    const [users] = await db.query('SELECT id, username, name, email, role, avatar, bio, status, last_seen, last_seen_privacy, story_privacy, chat_wallpaper, created_at FROM users WHERE id = ?', [req.user.id]);
    if (!users || users.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(users[0]);
  } catch (error) {
    res.status(500).json({ message: 'Server error: ' + error.message });
  }
};

// Update user profile and settings
exports.updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, bio, avatar, last_seen_privacy, story_privacy, chat_wallpaper } = req.body;

    const [currentRows] = await db.query('SELECT * FROM users WHERE id = ?', [userId]);
    if (!currentRows || currentRows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }
    const current = currentRows[0];

    const updatedName = name !== undefined && name.trim() ? name.trim() : current.name;
    const updatedBio = bio !== undefined ? bio.trim() : current.bio;
    const updatedAvatar = avatar !== undefined ? avatar.trim() : current.avatar;
    const validPrivacy = ['everyone', 'friends', 'nobody'];
    const updatedLastSeenPrivacy = validPrivacy.includes(last_seen_privacy) ? last_seen_privacy : (current.last_seen_privacy || 'everyone');
    const updatedStoryPrivacy = validPrivacy.includes(story_privacy) ? story_privacy : (current.story_privacy || 'everyone');
    const updatedWallpaper = chat_wallpaper !== undefined ? chat_wallpaper : (current.chat_wallpaper || 'default');

    await db.query(
      `UPDATE users SET name = ?, bio = ?, avatar = ?, last_seen_privacy = ?, story_privacy = ?, chat_wallpaper = ? WHERE id = ?`,
      [updatedName, updatedBio, updatedAvatar, updatedLastSeenPrivacy, updatedStoryPrivacy, updatedWallpaper, userId]
    );

    const [updatedUsers] = await db.query(
      'SELECT id, username, name, email, role, avatar, bio, status, last_seen, last_seen_privacy, story_privacy, chat_wallpaper, created_at FROM users WHERE id = ?',
      [userId]
    );

    res.json({
      message: 'Profile updated successfully',
      user: updatedUsers[0]
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ message: 'Server error updating profile: ' + error.message });
  }
};

// Search users by username or email
exports.searchUsers = async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.trim().length === 0) {
      return res.json([]);
    }

    const queryTerm = `%${q.trim()}%`;
    const [users] = await db.query(
      'SELECT id, username, name, email, avatar, bio, status FROM users WHERE (username LIKE ? OR email LIKE ? OR name LIKE ?) AND id != ? AND is_banned = FALSE LIMIT 20',
      [queryTerm, queryTerm, queryTerm, req.user.id]
    );

    // Also get connection status for each user
    const userListWithStatus = await Promise.all(users.map(async (u) => {
      const [requests] = await db.query(
        'SELECT id, sender_id, receiver_id, status FROM friend_requests WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)',
        [req.user.id, u.id, u.id, req.user.id]
      );

      let connectionStatus = 'none'; // 'none', 'pending_sent', 'pending_received', 'friends'
      let requestId = null;

      if (requests && requests.length > 0) {
        const reqItem = requests[0];
        requestId = reqItem.id;
        if (reqItem.status === 'accepted') {
          connectionStatus = 'friends';
        } else if (reqItem.status === 'pending') {
          connectionStatus = reqItem.sender_id === req.user.id ? 'pending_sent' : 'pending_received';
        }
      }

      return {
        ...u,
        connectionStatus,
        requestId
      };
    }));

    res.json(userListWithStatus);
  } catch (error) {
    console.error('Search users error:', error);
    res.status(500).json({ message: 'Server error: ' + error.message });
  }
};

// Get public profile of a user by ID
exports.getUserProfile = async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user.id;

    const [rows] = await db.query(
      'SELECT id, username, name, avatar, bio, status, last_seen, last_seen_privacy, created_at FROM users WHERE id = ? AND is_banned = FALSE',
      [userId]
    );

    if (!rows || rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const targetUser = rows[0];

    // Check friendship status
    const [friendship] = await db.query(
      'SELECT id, sender_id, receiver_id, status FROM friend_requests WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)',
      [currentUserId, userId, userId, currentUserId]
    );

    let isFriend = false;
    let friendRequestStatus = 'none';
    if (friendship && friendship.length > 0) {
      if (friendship[0].status === 'accepted') {
        isFriend = true;
        friendRequestStatus = 'friends';
      } else {
        friendRequestStatus = friendship[0].sender_id === currentUserId ? 'pending_sent' : 'pending_received';
      }
    }

    // Check streak if conversation exists
    const [convos] = await db.query(
      'SELECT streak_count, last_message_date FROM conversations WHERE (user1_id = ? AND user2_id = ?) OR (user1_id = ? AND user2_id = ?)',
      [currentUserId, userId, userId, currentUserId]
    );
    const streakCount = convos?.[0]?.streak_count || 0;

    // Check call permissions
    const [myPerm] = await db.query(
      'SELECT audio_allowed, video_allowed FROM call_permissions WHERE user_id = ? AND target_user_id = ?',
      [currentUserId, userId]
    );
    const [theirPerm] = await db.query(
      'SELECT audio_allowed, video_allowed FROM call_permissions WHERE user_id = ? AND target_user_id = ?',
      [userId, currentUserId]
    );
    const mutualAudioAllowed = Boolean(myPerm?.[0]?.audio_allowed && theirPerm?.[0]?.audio_allowed);
    const mutualVideoAllowed = Boolean(myPerm?.[0]?.video_allowed && theirPerm?.[0]?.video_allowed);

    // Apply last_seen privacy
    let visibleLastSeen = targetUser.last_seen;
    if (targetUser.last_seen_privacy === 'nobody') {
      visibleLastSeen = null;
    } else if (targetUser.last_seen_privacy === 'friends' && !isFriend && currentUserId !== targetUser.id) {
      visibleLastSeen = null;
    }

    res.json({
      id: targetUser.id,
      name: targetUser.name,
      username: targetUser.username,
      avatar: targetUser.avatar,
      bio: targetUser.bio || 'Hey there! I am using Wavy.',
      status: targetUser.status,
      last_seen: visibleLastSeen,
      last_seen_privacy: targetUser.last_seen_privacy,
      created_at: targetUser.created_at,
      isFriend,
      friendRequestStatus,
      streakCount,
      mutualAudioAllowed,
      mutualVideoAllowed
    });
  } catch (error) {
    console.error('Get user profile error:', error);
    res.status(500).json({ message: 'Server error: ' + error.message });
  }
};
