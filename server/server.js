const express = require('express');
const http = require('http');
const cors = require('cors');
const path = require('path');
const { Server } = require('socket.io');
require('dotenv').config();

const { initDB } = require('./config/db');
const apiRoutes = require('./routes/api');
const socketHandler = require('./socket/socketHandler');

const app = express();
const server = http.createServer(app);

// CORS configuration
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Static uploads folder with media headers for seamless streaming and seeking
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
  setHeaders: (res, filePath) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Type');
    res.setHeader('Accept-Ranges', 'bytes');

    const ext = path.extname(filePath).toLowerCase();
    const basename = path.basename(filePath).toLowerCase();
    if (ext === '.webm') {
      if (basename.includes('video') || basename.startsWith('vid')) {
        res.setHeader('Content-Type', 'video/webm');
      } else {
        res.setHeader('Content-Type', 'audio/webm');
      }
    } else if (ext === '.mp4') {
      res.setHeader('Content-Type', 'video/mp4');
    } else if (ext === '.mp3') {
      res.setHeader('Content-Type', 'audio/mpeg');
    } else if (ext === '.wav') {
      res.setHeader('Content-Type', 'audio/wav');
    } else if (ext === '.ogg') {
      res.setHeader('Content-Type', 'audio/ogg');
    }
  }
}));

// Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// API Routes
app.use('/api', apiRoutes);

// Socket.io setup
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Attach socket event handlers
socketHandler(io);

const PORT = process.env.PORT || 5000;

// Initialize Database and start server
async function startServer() {
  console.log('🚀 Initializing Chat App Server...');
  await initDB();

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`\n⚠️  Port ${PORT} is already in use by another running server instance.`);
      console.error(`👉 Close other running terminal windows or run: taskkill /F /IM node.exe\n`);
    } else {
      console.error('Server error:', err);
    }
  });

  server.listen(PORT, () => {
    console.log(`\n=================================================`);
    console.log(`🌐 Server running on http://localhost:${PORT}`);
    console.log(`📁 Static files served at http://localhost:${PORT}/uploads`);
    console.log(`🔑 Super Admin: shailenderga@gmail.com / 84249691@Sg (@admin)`);
    console.log(`=================================================\n`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
});
