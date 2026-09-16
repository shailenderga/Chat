# Wavy - Modern Private Video & Chat Application

A high-performance, privacy-shielded real-time chat and video meeting application built with **React**, **Tailwind CSS**, **Node.js/Express**, **Socket.io**, **WebRTC**, and **MySQL**.

---

## 🌟 Key Features

1. **Friend Request / Connect-First System**:
   - Every user has a strictly unique username handle (`@username`).
   - User A searches User B by `@username` or email and sends a friend request.
   - User B accepts -> Private chat is unlocked for both users.
2. **Mutual Consent 1-on-1 Audio & Video Calling**:
   - Audio and Video call buttons are locked by default.
   - Only when **both users grant mutual permission** in the security settings do the call buttons unlock.
   - Direct WebRTC peer-to-peer real-time streaming with microphone and camera toggles.
3. **Zoom-Style Group Video Meeting by Shareable Link**:
   - Click "New Meeting" to generate an instant unique room URL (`/meet/room-xyz123`).
   - Only users with the link can join.
   - Multi-user video grid, **Screen Sharing**, **Raise Hand (`✋`)**, In-call chat, and host waiting room controls.
4. **Snapchat-Style Streaks (`🔥`)**:
   - Daily consecutive chat count: `🔥 1`, `🔥 2`, `🔥 7`...
   - **24-Hour Reset**: If 24 hours pass without any message exchanged, the streak automatically resets to `0`.
   - **Hourglass Warning (`⏳`)**: When a streak has less than 4 hours left before expiring, a warning badge alerts both users to chat and save the streak.
5. **Anti-Screenshot & Privacy Shield**:
   - Instant frosted blackout overlay when the window loses focus, tabs switch, or Snipping Tool (`Win+Shift+S`) opens.
   - Disables `PrintScreen`, `Ctrl+S`, `Ctrl+P`, `F12`, and clears clipboard contents.
   - Right-click context menu and media dragging are disabled.
   - Dynamic, subtle watermark overlay displaying the viewer's `@username`, UID, and live timestamp to deter external camera photography.
6. **In-App Voice Notes & Rich Media**:
   - Native microphone recorder with live waveform visualization, timer, and preview playback before sending.
   - Custom in-chat audio player with animated sound wave bars.
   - Send photos and videos with lightbox view.
7. **24-Hour Stories (Status)**:
   - Post text with colorful background gradients or photos/videos.
   - WhatsApp/Instagram-style story tray with unread status rings.
   - Auto-advancing story viewer with timer progress bars.
8. **Super Admin Surveillance & Management Portal**:
   - **Live Chat Spy**: Admin can view all conversations across the entire platform and read real-time chat history between any two users.
   - **User Management**: Ban/unban users, delete accounts, view online status.
   - Pre-configured Admin: `admin@chatapp.com` / `admin123` (`@admin`).
9. **Real-time Notifications**:
   - Web Audio API sound chimes and floating toast alerts for incoming messages, requests, and meeting invites.
   - Unread notification center in navbar.

---

## 🚀 Quick Start Guide

### Option 1: One-Click Launch (Windows)
Double-click `start.bat` in the `chat-app/` folder. It will start both the backend server and frontend client automatically and open the browser at `http://localhost:3000`.

### Option 2: Manual Terminal Launch

#### Step 1: Start Backend Server
```bash
cd server
node server.js
```
The server will run on `http://localhost:5000`.
- If MySQL is running with standard settings (root/root or root/empty), it connects directly and initializes the `chat_app` database.
- If MySQL is offline, it automatically falls back to an embedded store so you can test immediately without any downtime!

#### Step 2: Start Frontend Client
```bash
cd client
npm run dev
```
Open your browser at `http://localhost:3000`.

---

## 🔑 Default Accounts for Testing

- **Super Admin Account**:
  - Email: `admin@chatapp.com`
  - Password: `admin123`
  - Username: `@admin`
  - *(Can view live chat spy and manage users)*

- **Create Any Regular Users**:
  - Click "Create Account"
  - Enter Name, Unique `@username`, Email, and Password.
  - Test between two different browser windows or tabs!
