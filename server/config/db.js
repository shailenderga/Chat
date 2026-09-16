const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

let pool = null;
let isFallback = false;
const os = require('os');

// Fallback in-memory / JSON store in case MySQL credentials fail or service is locked
const fallbackDataPath = process.env.VERCEL
  ? path.join(os.tmpdir(), 'data_store.json')
  : path.join(__dirname, '..', 'data_store.json');
let fallbackStore = {
  users: [],
  friend_requests: [],
  call_permissions: [],
  conversations: [],
  messages: [],
  meeting_rooms: [],
  stories: [],
  story_views: [],
  notifications: []
};

function loadFallbackStore() {
  try {
    if (fs.existsSync(fallbackDataPath)) {
      fallbackStore = JSON.parse(fs.readFileSync(fallbackDataPath, 'utf8'));
    }
  } catch (err) {
    console.error('Error loading fallback store:', err);
  }
}

function saveFallbackStore() {
  try {
    fs.writeFileSync(fallbackDataPath, JSON.stringify(fallbackStore, null, 2), 'utf8');
  } catch (err) {
    console.error('Error saving fallback store:', err);
  }
}

async function initDB() {
  const host = process.env.DB_HOST || 'localhost';
  const user = process.env.DB_USER || 'root';
  const password = process.env.DB_PASSWORD || '';
  const port = process.env.DB_PORT || 3306;
  const database = process.env.DB_NAME || 'chat_app';

  try {
    // 1. Try to connect to MySQL server (without specifying DB to ensure DB can be created)
    console.log(`Connecting to MySQL at ${host}:${port} as ${user}...`);
    const rootConn = await mysql.createConnection({
      host,
      user,
      password,
      port: Number(port)
    });

    await rootConn.query(`CREATE DATABASE IF NOT EXISTS \`${database}\`;`);
    await rootConn.end();

    // 2. Create pool with the database
    pool = mysql.createPool({
      host,
      user,
      password,
      port: Number(port),
      database,
      waitForConnections: true,
      connectionLimit: 15,
      queueLimit: 0
    });

    // Test connection
    const connection = await pool.getConnection();
    console.log(`Successfully connected to MySQL database: ${database}`);
    connection.release();

    // 3. Create tables
    await createMySQLTables();
    await seedDefaultAdmin();
    return true;
  } catch (error) {
    console.warn('⚠️  Could not connect to MySQL (' + error.message + ').');
    console.warn('➡️  Switching to Embedded Local Database fallback so you can use and test the application immediately!');
    isFallback = true;
    loadFallbackStore();
    await seedDefaultAdminFallback();
    return false;
  }
}

async function createMySQLTables() {
  const queries = [
    `CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(50) UNIQUE NOT NULL,
      name VARCHAR(100) NOT NULL,
      email VARCHAR(120) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      role ENUM('user', 'admin') DEFAULT 'user',
      avatar VARCHAR(255) DEFAULT '',
      bio VARCHAR(255) DEFAULT 'Hey there! I am using ChatApp',
      is_banned BOOLEAN DEFAULT FALSE,
      status ENUM('online', 'offline') DEFAULT 'offline',
      last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      last_seen_privacy ENUM('everyone', 'friends', 'nobody') DEFAULT 'everyone',
      story_privacy ENUM('everyone', 'friends', 'nobody') DEFAULT 'everyone',
      chat_wallpaper VARCHAR(255) DEFAULT 'default',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );`,

    `CREATE TABLE IF NOT EXISTS friend_requests (
      id INT AUTO_INCREMENT PRIMARY KEY,
      sender_id INT NOT NULL,
      receiver_id INT NOT NULL,
      status ENUM('pending', 'accepted', 'rejected') DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE KEY unique_request (sender_id, receiver_id)
    );`,

    `CREATE TABLE IF NOT EXISTS call_permissions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      target_user_id INT NOT NULL,
      audio_allowed BOOLEAN DEFAULT FALSE,
      video_allowed BOOLEAN DEFAULT FALSE,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (target_user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE KEY unique_perm (user_id, target_user_id)
    );`,

    `CREATE TABLE IF NOT EXISTS conversations (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user1_id INT NOT NULL,
      user2_id INT NOT NULL,
      streak_count INT DEFAULT 0,
      last_message_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      last_streak_date DATE DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user1_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (user2_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE KEY unique_convo (user1_id, user2_id)
    );`,

    `CREATE TABLE IF NOT EXISTS messages (
      id INT AUTO_INCREMENT PRIMARY KEY,
      conversation_id INT NOT NULL,
      sender_id INT NOT NULL,
      message_type ENUM('text', 'image', 'video', 'audio', 'voice_note', 'meeting_invite') DEFAULT 'text',
      content TEXT,
      file_url VARCHAR(255) DEFAULT NULL,
      file_size INT DEFAULT 0,
      duration INT DEFAULT 0,
      is_ephemeral BOOLEAN DEFAULT FALSE,
      expires_at TIMESTAMP NULL DEFAULT NULL,
      reactions TEXT DEFAULT NULL,
      is_deleted_for_everyone BOOLEAN DEFAULT FALSE,
      deleted_for_users TEXT DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
      FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE
    );`,

    `CREATE TABLE IF NOT EXISTS meeting_rooms (
      id VARCHAR(64) PRIMARY KEY,
      host_id INT NOT NULL,
      title VARCHAR(150) DEFAULT 'Video Meeting',
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (host_id) REFERENCES users(id) ON DELETE CASCADE
    );`,

    `CREATE TABLE IF NOT EXISTS stories (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      media_type ENUM('image', 'video', 'text') DEFAULT 'image',
      media_url VARCHAR(255) DEFAULT NULL,
      caption TEXT DEFAULT NULL,
      bg_gradient VARCHAR(100) DEFAULT '',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      expires_at TIMESTAMP NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );`,

    `CREATE TABLE IF NOT EXISTS notifications (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      type ENUM('message', 'request', 'call_permission', 'streak', 'meeting') NOT NULL,
      title VARCHAR(150) NOT NULL,
      content TEXT,
      metadata TEXT DEFAULT NULL,
      is_read BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );`,

    `CREATE TABLE IF NOT EXISTS story_views (
      id INT AUTO_INCREMENT PRIMARY KEY,
      story_id INT NOT NULL,
      viewer_id INT NOT NULL,
      viewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (story_id) REFERENCES stories(id) ON DELETE CASCADE,
      FOREIGN KEY (viewer_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE KEY unique_story_view (story_id, viewer_id)
    );`
  ];

  for (const q of queries) {
    await pool.query(q);
  }

  // Safe migrations for existing messages table
  try {
    await pool.query("ALTER TABLE messages ADD COLUMN is_deleted_for_everyone BOOLEAN DEFAULT FALSE");
  } catch (e) {}
  try {
    await pool.query("ALTER TABLE messages ADD COLUMN deleted_for_users TEXT DEFAULT NULL");
  } catch (e) {}

  // Safe migrations for existing users table
  try {
    await pool.query("ALTER TABLE users ADD COLUMN last_seen_privacy ENUM('everyone', 'friends', 'nobody') DEFAULT 'everyone'");
  } catch (e) {}
  try {
    await pool.query("ALTER TABLE users ADD COLUMN story_privacy ENUM('everyone', 'friends', 'nobody') DEFAULT 'everyone'");
  } catch (e) {}
  try {
    await pool.query("ALTER TABLE users ADD COLUMN chat_wallpaper VARCHAR(255) DEFAULT 'default'");
  } catch (e) {}
}

async function seedDefaultAdmin() {
  const adminEmail = 'shailenderga@gmail.com';
  const adminPass = '84249691@Sg';
  const hash = await bcrypt.hash(adminPass, 10);

  const [rows] = await pool.query("SELECT * FROM users WHERE email = ?", [adminEmail]);
  if (rows.length > 0) {
    await pool.query(
      "UPDATE users SET password_hash = ?, role = 'admin' WHERE email = ?",
      [hash, adminEmail]
    );
    console.log(`✅ Updated Admin: ${adminEmail}`);
  } else {
    const [oldRows] = await pool.query("SELECT * FROM users WHERE email = 'admin@chatapp.com' OR role = 'admin'");
    if (oldRows.length > 0) {
      await pool.query(
        "UPDATE users SET email = ?, password_hash = ?, role = 'admin' WHERE id = ?",
        [adminEmail, hash, oldRows[0].id]
      );
      console.log(`✅ Updated Admin Account to: ${adminEmail}`);
    } else {
      await pool.query(
        `INSERT INTO users (username, name, email, password_hash, role, bio) 
         VALUES ('admin', 'Super Admin', ?, ?, 'admin', 'Official System Administrator')`,
        [adminEmail, hash]
      );
      console.log(`✅ Seeded Super Admin: ${adminEmail}`);
    }
  }
}

async function seedDefaultAdminFallback() {
  const adminEmail = 'shailenderga@gmail.com';
  const adminPass = '84249691@Sg';
  const hash = await bcrypt.hash(adminPass, 10);

  const existing = fallbackStore.users.find(u => u.email === adminEmail || u.role === 'admin');
  if (existing) {
    existing.email = adminEmail;
    existing.password_hash = hash;
    existing.role = 'admin';
    saveFallbackStore();
    console.log(`✅ Updated Fallback Admin: ${adminEmail}`);
  } else {
    fallbackStore.users.push({
      id: 1,
      username: 'admin',
      name: 'Super Admin',
      email: adminEmail,
      password_hash: hash,
      role: 'admin',
      avatar: '',
      bio: 'Official System Administrator',
      is_banned: false,
      status: 'offline',
      last_seen: new Date().toISOString(),
      created_at: new Date().toISOString()
    });
    saveFallbackStore();
    console.log(`✅ Seeded Fallback Admin: ${adminEmail}`);
  }
}

// Unified query wrapper
async function query(sql, params = []) {
  if (!isFallback && pool) {
    const [rows, fields] = await pool.query(sql, params);
    return [rows, fields];
  }

  // Handle fallback operations
  return handleFallbackQuery(sql, params);
}

function handleFallbackQuery(sql, params) {
  const trimmed = sql.trim().toUpperCase();

  // Helper matching
  if (trimmed.startsWith('SELECT')) {
    // Basic table parser
    if (sql.includes('FROM users')) {
      let results = [...fallbackStore.users];
      if (sql.includes('WHERE email = ?')) {
        results = results.filter(u => u.email.toLowerCase() === params[0].toLowerCase());
      } else if (sql.includes('WHERE username = ?')) {
        results = results.filter(u => u.username.toLowerCase() === params[0].toLowerCase());
      } else if (sql.includes('WHERE id = ?')) {
        results = results.filter(u => Number(u.id) === Number(params[0]));
      } else if (sql.includes('WHERE (username LIKE ? OR email LIKE ? OR name LIKE ?)')) {
        const queryTerm = params[0].replace(/%/g, '').toLowerCase();
        results = results.filter(u => 
          u.username.toLowerCase().includes(queryTerm) ||
          u.email.toLowerCase().includes(queryTerm) ||
          u.name.toLowerCase().includes(queryTerm)
        );
      }
      return [results, null];
    }

    if (sql.includes('FROM friend_requests')) {
      let results = [...fallbackStore.friend_requests];
      if (sql.includes('WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)')) {
        results = results.filter(r => 
          (r.sender_id === params[0] && r.receiver_id === params[1]) ||
          (r.sender_id === params[2] && r.receiver_id === params[3])
        );
      } else if (sql.includes('WHERE receiver_id = ? AND status = ?')) {
        results = results.filter(r => r.receiver_id === params[0] && r.status === params[1]);
      } else if (sql.includes('WHERE sender_id = ?')) {
        results = results.filter(r => r.sender_id === params[0]);
      } else if (sql.includes('WHERE id = ?')) {
        results = results.filter(r => r.id === params[0]);
      }
      return [results, null];
    }

    if (sql.includes('FROM call_permissions')) {
      let results = [...fallbackStore.call_permissions];
      if (sql.includes('WHERE user_id = ? AND target_user_id = ?')) {
        results = results.filter(p => p.user_id === params[0] && p.target_user_id === params[1]);
      }
      return [results, null];
    }

    if (sql.includes('FROM conversations')) {
      let results = [...fallbackStore.conversations];
      if (sql.includes('WHERE (user1_id = ? AND user2_id = ?) OR (user1_id = ? AND user2_id = ?)')) {
        results = results.filter(c => 
          (c.user1_id === params[0] && c.user2_id === params[1]) ||
          (c.user1_id === params[2] && c.user2_id === params[3])
        );
      } else if (sql.includes('WHERE user1_id = ? OR user2_id = ?')) {
        results = results.filter(c => c.user1_id === params[0] || c.user2_id === params[0]);
      } else if (sql.includes('WHERE id = ?')) {
        results = results.filter(c => c.id === params[0]);
      }
      return [results, null];
    }

    if (sql.includes('FROM messages')) {
      let results = [...fallbackStore.messages];
      if (sql.includes('WHERE conversation_id = ?')) {
        results = results.filter(m => m.conversation_id === params[0]);
      } else if (sql.includes('WHERE id = ?')) {
        results = results.filter(m => m.id === params[0]);
      }
      return [results, null];
    }

    if (sql.includes('FROM stories')) {
      let results = [...fallbackStore.stories];
      const now = new Date();
      results = results.filter(s => new Date(s.expires_at) > now);
      return [results, null];
    }

    if (sql.includes('FROM notifications')) {
      let results = [...fallbackStore.notifications];
      if (sql.includes('WHERE user_id = ?')) {
        results = results.filter(n => n.user_id === params[0]);
      }
      return [results, null];
    }

    if (sql.includes('FROM meeting_rooms')) {
      let results = [...fallbackStore.meeting_rooms];
      if (sql.includes('WHERE id = ?')) {
        results = results.filter(m => m.id === params[0]);
      }
      return [results, null];
    }

    if (sql.includes('FROM story_views')) {
      let results = [...(fallbackStore.story_views || [])];
      if (sql.includes('WHERE story_id = ? AND viewer_id = ?')) {
        results = results.filter(v => v.story_id === params[0] && v.viewer_id === params[1]);
      } else if (sql.includes('WHERE story_id = ?')) {
        results = results.filter(v => v.story_id === params[0]);
      } else if (sql.includes('WHERE sv.story_id = ?')) {
        results = results.filter(v => v.story_id === params[0]).map(v => {
          const u = fallbackStore.users.find(usr => usr.id === v.viewer_id) || {};
          return {
            id: v.id,
            viewed_at: v.viewed_at,
            user_id: u.id,
            name: u.name,
            username: u.username,
            avatar: u.avatar
          };
        });
      }
      return [results, null];
    }

    return [[], null];
  }

  if (trimmed.startsWith('INSERT INTO')) {
    const genId = Date.now() + Math.floor(Math.random() * 1000);
    if (sql.includes('INTO users')) {
      const newUser = {
        id: genId,
        username: params[0],
        name: params[1],
        email: params[2],
        password_hash: params[3],
        avatar: params[4] || '',
        bio: params[5] || 'Hey there! I am using ChatApp',
        role: params[6] || 'user',
        is_banned: false,
        status: 'offline',
        last_seen: new Date().toISOString(),
        created_at: new Date().toISOString()
      };
      fallbackStore.users.push(newUser);
      saveFallbackStore();
      return [{ insertId: genId, affectedRows: 1 }, null];
    }

    if (sql.includes('INTO friend_requests')) {
      const newReq = {
        id: genId,
        sender_id: params[0],
        receiver_id: params[1],
        status: 'pending',
        created_at: new Date().toISOString()
      };
      fallbackStore.friend_requests.push(newReq);
      saveFallbackStore();
      return [{ insertId: genId, affectedRows: 1 }, null];
    }

    if (sql.includes('INTO conversations')) {
      const newConvo = {
        id: genId,
        user1_id: params[0],
        user2_id: params[1],
        streak_count: 0,
        last_message_time: new Date().toISOString(),
        last_streak_date: null,
        created_at: new Date().toISOString()
      };
      fallbackStore.conversations.push(newConvo);
      saveFallbackStore();
      return [{ insertId: genId, affectedRows: 1 }, null];
    }

    if (sql.includes('INTO messages')) {
      const newMsg = {
        id: genId,
        conversation_id: params[0],
        sender_id: params[1],
        message_type: params[2],
        content: params[3],
        file_url: params[4] || null,
        duration: params[5] || 0,
        is_ephemeral: params[6] || false,
        expires_at: params[7] || null,
        reactions: null,
        created_at: new Date().toISOString()
      };
      fallbackStore.messages.push(newMsg);
      saveFallbackStore();
      return [{ insertId: genId, affectedRows: 1 }, null];
    }

    if (sql.includes('INTO meeting_rooms')) {
      const room = {
        id: params[0],
        host_id: params[1],
        title: params[2],
        is_active: true,
        created_at: new Date().toISOString()
      };
      fallbackStore.meeting_rooms.push(room);
      saveFallbackStore();
      return [{ insertId: room.id, affectedRows: 1 }, null];
    }

    if (sql.includes('INTO stories')) {
      const story = {
        id: genId,
        user_id: params[0],
        media_type: params[1],
        media_url: params[2],
        caption: params[3],
        bg_gradient: params[4],
        created_at: new Date().toISOString(),
        expires_at: params[5]
      };
      fallbackStore.stories.push(story);
      saveFallbackStore();
      return [{ insertId: genId, affectedRows: 1 }, null];
    }

    if (sql.includes('INTO notifications')) {
      const notif = {
        id: genId,
        user_id: params[0],
        type: params[1],
        title: params[2],
        content: params[3],
        metadata: params[4] || null,
        is_read: false,
        created_at: new Date().toISOString()
      };
      fallbackStore.notifications.push(notif);
      saveFallbackStore();
      return [{ insertId: genId, affectedRows: 1 }, null];
    }

    if (sql.includes('INTO story_views')) {
      if (!fallbackStore.story_views) fallbackStore.story_views = [];
      const view = {
        id: genId,
        story_id: params[0],
        viewer_id: params[1],
        viewed_at: new Date().toISOString()
      };
      fallbackStore.story_views.push(view);
      saveFallbackStore();
      return [{ insertId: genId, affectedRows: 1 }, null];
    }

    saveFallbackStore();
    return [{ insertId: genId, affectedRows: 1 }, null];
  }

  if (trimmed.startsWith('UPDATE')) {
    if (sql.includes('friend_requests SET status = ? WHERE id = ?')) {
      const req = fallbackStore.friend_requests.find(r => r.id === params[1]);
      if (req) req.status = params[0];
      saveFallbackStore();
      return [{ affectedRows: req ? 1 : 0 }, null];
    }

    if (sql.includes('conversations SET streak_count = ?')) {
      const c = fallbackStore.conversations.find(conv => conv.id === params[params.length - 1]);
      if (c) {
        c.streak_count = params[0];
        c.last_streak_date = params[1];
        c.last_message_time = new Date().toISOString();
      }
      saveFallbackStore();
      return [{ affectedRows: c ? 1 : 0 }, null];
    }

    if (sql.includes('users SET is_banned = ? WHERE id = ?')) {
      const u = fallbackStore.users.find(usr => usr.id === params[1]);
      if (u) u.is_banned = Boolean(params[0]);
      saveFallbackStore();
      return [{ affectedRows: u ? 1 : 0 }, null];
    }

    if (sql.includes('notifications SET is_read = TRUE WHERE user_id = ?')) {
      fallbackStore.notifications.forEach(n => {
        if (n.user_id === params[0]) n.is_read = true;
      });
      saveFallbackStore();
      return [{ affectedRows: 1 }, null];
    }

    if (sql.includes('messages SET is_deleted_for_everyone = TRUE')) {
      const msg = fallbackStore.messages.find(m => m.id === params[params.length - 1]);
      if (msg) {
        msg.is_deleted_for_everyone = true;
        msg.content = '🚫 This message was deleted';
        msg.file_url = null;
      }
      saveFallbackStore();
      return [{ affectedRows: msg ? 1 : 0 }, null];
    }

    if (sql.includes('messages SET deleted_for_users = ? WHERE id = ?')) {
      const msg = fallbackStore.messages.find(m => m.id === params[1]);
      if (msg) {
        msg.deleted_for_users = params[0];
      }
      saveFallbackStore();
      return [{ affectedRows: msg ? 1 : 0 }, null];
    }

    saveFallbackStore();
    return [{ affectedRows: 1 }, null];
  }

  if (trimmed.startsWith('DELETE')) {
    if (sql.includes('FROM users WHERE id = ?')) {
      fallbackStore.users = fallbackStore.users.filter(u => u.id !== params[0]);
      saveFallbackStore();
      return [{ affectedRows: 1 }, null];
    }
    if (sql.includes('FROM stories WHERE id = ?')) {
      fallbackStore.stories = fallbackStore.stories.filter(s => s.id !== params[0]);
      if (fallbackStore.story_views) {
        fallbackStore.story_views = fallbackStore.story_views.filter(v => v.story_id !== params[0]);
      }
      saveFallbackStore();
      return [{ affectedRows: 1 }, null];
    }
    return [{ affectedRows: 1 }, null];
  }

  return [[], null];
}

module.exports = {
  initDB,
  query,
  getFallbackStore: () => fallbackStore,
  isFallbackMode: () => isFallback
};
