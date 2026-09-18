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

    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Please provide your full name' });
    }

    if (!username || !username.trim()) {
      return res.status(400).json({ message: 'Please provide a unique username handle' });
    }

    if (!email || !email.trim()) {
      return res.status(400).json({ message: 'Please provide an email address' });
    }

    if (!password || password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters long' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      return res.status(400).json({ message: 'Please provide a valid email address' });
    }

    const cleanUsername = username.trim().toLowerCase().replace(/[^a-z0-9_.]/g, '');
    if (cleanUsername.length < 3) {
      return res.status(400).json({ message: 'Username must be at least 3 characters long (letters, numbers, underscores)' });
    }

    // Check duplicate email
    const [existingEmail] = await db.query('SELECT id FROM users WHERE email = ?', [cleanEmail]);
    if (existingEmail && existingEmail.length > 0) {
      return res.status(400).json({ message: 'An account with this email already exists. Please sign in or reset your password.' });
    }

    // Check duplicate username
    const [existingUsername] = await db.query('SELECT id FROM users WHERE username = ?', [cleanUsername]);
    if (existingUsername && existingUsername.length > 0) {
      return res.status(400).json({ message: `The username @${cleanUsername} is already taken. Please choose another username.` });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const defaultAvatar = avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${cleanUsername}`;
    const userBio = bio || 'Hey there! I am using ChatApp';

    let result;
    try {
      [result] = await db.query(
        'INSERT INTO users (username, name, email, password_hash, avatar, bio, role) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [cleanUsername, name.trim(), cleanEmail, passwordHash, defaultAvatar, userBio, 'user']
      );
    } catch (insertErr) {
      // Fallback for legacy tables missing avatar, bio, or role columns
      if (insertErr.message && (insertErr.message.includes('Unknown column') || insertErr.code === 'ER_BAD_FIELD_ERROR')) {
        console.warn('Full insert failed due to column variation, using minimal insert fallback:', insertErr.message);
        [result] = await db.query(
          'INSERT INTO users (username, name, email, password_hash) VALUES (?, ?, ?, ?)',
          [cleanUsername, name.trim(), cleanEmail, passwordHash]
        );
      } else {
        throw insertErr;
      }
    }

    let newUserId = result?.insertId;
    if (!newUserId) {
      const [newRows] = await db.query('SELECT id FROM users WHERE email = ?', [cleanEmail]);
      if (newRows && newRows.length > 0) {
        newUserId = newRows[0].id;
      }
    }

    const user = {
      id: newUserId,
      username: cleanUsername,
      name: name.trim(),
      email: cleanEmail,
      role: 'user',
      avatar: defaultAvatar,
      bio: userBio,
      is_banned: false,
      status: 'online',
      last_seen_privacy: 'everyone',
      story_privacy: 'everyone',
      chat_wallpaper: 'default'
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

// Login with Email OR Username + Password
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Please enter your email or username, and your password' });
    }

    const rawInput = email.trim().toLowerCase();
    const cleanUsername = rawInput.replace(/^@/, '');

    const [users] = await db.query(
      'SELECT * FROM users WHERE email = ? OR username = ?',
      [rawInput, cleanUsername]
    );

    if (!users || users.length === 0) {
      return res.status(401).json({ 
        message: `No account found for '${email.trim()}'. Please click 'Create Account' to sign up.`,
        notFound: true 
      });
    }

    const user = users[0];

    if (user.is_banned) {
      return res.status(403).json({ message: 'This account has been banned by the Administrator.' });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ message: 'Incorrect password. Please check your password or use Forgot Password.' });
    }

    // Update status to online (safe against missing columns)
    try {
      await db.query('UPDATE users SET status = ?, last_seen = CURRENT_TIMESTAMP WHERE id = ?', ['online', user.id]);
    } catch (e) {
      console.warn('Could not update status/last_seen on login:', e.message);
    }

    const token = generateToken(user);

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        email: user.email,
        role: user.role || 'user',
        avatar: user.avatar || '',
        bio: user.bio || 'Hey there! I am using ChatApp',
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
    let users;
    try {
      [users] = await db.query(
        'SELECT id, username, name, email, role, avatar, bio, status, last_seen, last_seen_privacy, story_privacy, chat_wallpaper, created_at FROM users WHERE id = ?',
        [req.user.id]
      );
    } catch (queryErr) {
      if (queryErr.message && (queryErr.message.includes('Unknown column') || queryErr.code === 'ER_BAD_FIELD_ERROR')) {
        [users] = await db.query('SELECT * FROM users WHERE id = ?', [req.user.id]);
      } else {
        throw queryErr;
      }
    }

    if (!users || users.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const u = users[0];
    res.json({
      id: u.id,
      username: u.username,
      name: u.name,
      email: u.email,
      role: u.role || 'user',
      avatar: u.avatar || '',
      bio: u.bio || 'Hey there! I am using ChatApp',
      status: u.status || 'offline',
      last_seen: u.last_seen || u.created_at,
      last_seen_privacy: u.last_seen_privacy || 'everyone',
      story_privacy: u.story_privacy || 'everyone',
      chat_wallpaper: u.chat_wallpaper || 'default',
      created_at: u.created_at
    });
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
      'SELECT streak_count FROM conversations WHERE (user1_id = ? AND user2_id = ?) OR (user1_id = ? AND user2_id = ?)',
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

// User Heartbeat (keeps user marked as online in DB)
exports.heartbeat = async (req, res) => {
  try {
    const userId = req.user.id;
    await db.query('UPDATE users SET status = ?, last_seen = CURRENT_TIMESTAMP WHERE id = ?', ['online', userId]);
    res.json({ status: 'ok' });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

// Get all currently active online users (pinged within last 30s)
exports.getOnlineUsers = async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT id FROM users WHERE status = 'online' AND last_seen >= (CURRENT_TIMESTAMP - INTERVAL 30 SECOND) AND is_banned = FALSE"
    );
    const onlineIds = (rows || []).map(r => r.id);
    res.json(onlineIds);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

// Request Password Reset Code
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || !email.trim()) {
      return res.status(400).json({ message: 'Please enter your registered email address or username' });
    }

    const rawInput = email.trim().toLowerCase();
    const cleanUsername = rawInput.replace(/^@/, '');

    const [users] = await db.query(
      'SELECT id, name, email, username FROM users WHERE email = ? OR username = ?',
      [rawInput, cleanUsername]
    );

    if (!users || users.length === 0) {
      return res.status(404).json({ message: 'No registered user found with this email or username' });
    }

    const user = users[0];
    const cleanEmail = user.email;

    // Generate 6-digit numeric OTP code
    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 mins

    // Sign a cryptographic reset token (15 mins) that is stateless and works across all serverless instances
    const resetToken = jwt.sign(
      { email: cleanEmail, code: resetCode },
      process.env.JWT_SECRET || 'super_secret_jwt_chat_app_key_2026',
      { expiresIn: '15m' }
    );

    // Store in database
    try {
      await db.query(
        'UPDATE users SET reset_code = ?, reset_expires = ? WHERE email = ?',
        [resetCode, expiresAt, cleanEmail]
      );
    } catch (dbErr) {
      console.warn('DB reset code update warning:', dbErr.message);
    }

    console.log(`🔐 Password reset code generated for ${cleanEmail}: ${resetCode}`);

    return res.json({
      message: 'Verification code generated successfully',
      email: cleanEmail,
      code: resetCode,
      resetToken
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ message: 'Server error: ' + error.message });
  }
};

// Reset Password with Code
exports.resetPassword = async (req, res) => {
  try {
    const { email, code, newPassword, resetToken } = req.body;

    if (!email || !code || !newPassword) {
      return res.status(400).json({ message: 'Please provide email, verification code, and new password' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters long' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanCode = String(code).trim();

    let isCodeValid = false;

    // Method A: Cryptographic JWT resetToken verification (guaranteed in serverless)
    if (resetToken) {
      try {
        const decoded = jwt.verify(
          resetToken,
          process.env.JWT_SECRET || 'super_secret_jwt_chat_app_key_2026'
        );
        if (decoded && decoded.email.toLowerCase() === cleanEmail && String(decoded.code).trim() === cleanCode) {
          isCodeValid = true;
        }
      } catch (jwtErr) {
        console.warn('JWT resetToken verify warning:', jwtErr.message);
      }
    }

    // Method B: Database check
    if (!isCodeValid) {
      const [users] = await db.query(
        'SELECT id, email, reset_code, reset_expires FROM users WHERE email = ?',
        [cleanEmail]
      );

      if (!users || users.length === 0) {
        return res.status(404).json({ message: 'No account found with this email address' });
      }

      const user = users[0];
      if (user.reset_code && String(user.reset_code).trim() === cleanCode) {
        if (!user.reset_expires || new Date(user.reset_expires) > new Date()) {
          isCodeValid = true;
        } else {
          return res.status(400).json({ message: 'Verification code has expired. Please request a new code.' });
        }
      }
    }

    if (!isCodeValid) {
      return res.status(400).json({ message: 'Invalid verification code. Please check and try again.' });
    }

    // Hash the new password with bcrypt
    const newHash = await bcrypt.hash(newPassword, 10);

    // Update password and clear reset fields in database
    await db.query(
      'UPDATE users SET password_hash = ?, reset_code = NULL, reset_expires = NULL WHERE email = ?',
      [newHash, cleanEmail]
    );

    console.log(`✅ Password successfully reset for user ${cleanEmail}`);

    return res.json({
      message: 'Password has been reset successfully! You can now sign in with your new password.'
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ message: 'Server error: ' + error.message });
  }
};

