-- Modern Chat App Database Schema for MySQL

CREATE DATABASE IF NOT EXISTS chat_app;
USE chat_app;

-- Users Table
CREATE TABLE IF NOT EXISTS users (
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
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Friend / Chat Requests
CREATE TABLE IF NOT EXISTS friend_requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  sender_id INT NOT NULL,
  receiver_id INT NOT NULL,
  status ENUM('pending', 'accepted', 'rejected') DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY unique_request (sender_id, receiver_id)
);

-- Mutual Call Permissions (Both must grant permission for Audio & Video)
CREATE TABLE IF NOT EXISTS call_permissions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  target_user_id INT NOT NULL,
  audio_allowed BOOLEAN DEFAULT FALSE,
  video_allowed BOOLEAN DEFAULT FALSE,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (target_user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY unique_perm (user_id, target_user_id)
);

-- Conversations with Streak Tracking
CREATE TABLE IF NOT EXISTS conversations (
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
);

-- Messages
CREATE TABLE IF NOT EXISTS messages (
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
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
  FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Meeting Rooms (Zoom style link meetings)
CREATE TABLE IF NOT EXISTS meeting_rooms (
  id VARCHAR(64) PRIMARY KEY,
  host_id INT NOT NULL,
  title VARCHAR(150) DEFAULT 'Video Meeting',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (host_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Stories (24h validity)
CREATE TABLE IF NOT EXISTS stories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  media_type ENUM('image', 'video', 'text') DEFAULT 'image',
  media_url VARCHAR(255) DEFAULT NULL,
  caption TEXT DEFAULT NULL,
  bg_gradient VARCHAR(100) DEFAULT '',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Story Views (Who viewed the story)
CREATE TABLE IF NOT EXISTS story_views (
  id INT AUTO_INCREMENT PRIMARY KEY,
  story_id INT NOT NULL,
  viewer_id INT NOT NULL,
  viewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (story_id) REFERENCES stories(id) ON DELETE CASCADE,
  FOREIGN KEY (viewer_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY unique_story_view (story_id, viewer_id)
);

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  type ENUM('message', 'request', 'call_permission', 'streak', 'meeting') NOT NULL,
  title VARCHAR(150) NOT NULL,
  content TEXT,
  metadata TEXT DEFAULT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

