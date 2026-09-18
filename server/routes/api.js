const express = require('express');
const router = express.Router();

const { verifyToken, verifyAdmin } = require('../middleware/auth');
const authController = require('../controllers/authController');
const requestController = require('../controllers/requestController');
const chatController = require('../controllers/chatController');
const callPermissionController = require('../controllers/callPermissionController');
const meetingController = require('../controllers/meetingController');
const storyController = require('../controllers/storyController');
const adminController = require('../controllers/adminController');
const notificationController = require('../controllers/notificationController');

// --- Auth Routes ---
router.post('/auth/register', authController.register);
router.post('/auth/login', authController.login);
router.post('/auth/forgot-password', authController.forgotPassword);
router.post('/auth/reset-password', authController.resetPassword);
router.get('/auth/check-username/:username', authController.checkUsername);
router.get('/auth/me', verifyToken, authController.getMe);
router.put('/auth/profile', verifyToken, authController.updateProfile);
router.get('/users/search', verifyToken, authController.searchUsers);
router.get('/users/:userId/profile', verifyToken, authController.getUserProfile);
router.post('/users/heartbeat', verifyToken, authController.heartbeat);
router.get('/users/online', verifyToken, authController.getOnlineUsers);

// --- Friend Request Routes ---
router.post('/requests/send', verifyToken, requestController.sendRequest);
router.put('/requests/:requestId/accept', verifyToken, requestController.acceptRequest);
router.put('/requests/:requestId/reject', verifyToken, requestController.rejectRequest);
router.get('/requests', verifyToken, requestController.getRequests);

// --- Chat & Message Routes ---
router.get('/chats/conversations', verifyToken, chatController.getConversations);
router.get('/chats/:conversationId/messages', verifyToken, chatController.getMessages);
router.post('/chats/:conversationId/messages', verifyToken, chatController.sendMessage);
router.post('/chats/:conversationId/read', verifyToken, chatController.markMessagesRead);
router.post('/chats/messages/:messageId/react', verifyToken, chatController.addReaction);
router.delete('/chats/messages/:messageId', verifyToken, chatController.deleteMessage);
router.post('/chats/upload', verifyToken, chatController.uploadMiddleware, chatController.uploadMedia);

// --- Call Permission Routes (Mutual Consent) ---
router.get('/call-permission/:partnerId', verifyToken, callPermissionController.getPermissionStatus);
router.post('/call-permission/update', verifyToken, callPermissionController.updatePermission);
router.post('/call-permission/request', verifyToken, callPermissionController.requestPermission);

// --- Zoom-Style Meeting Routes ---
router.post('/meetings/create', verifyToken, meetingController.createMeeting);
router.get('/meetings/:roomId', verifyToken, meetingController.getMeeting);
router.post('/meetings/:roomId/end', verifyToken, meetingController.endMeeting);

// --- 24h Stories Routes ---
router.post('/stories', verifyToken, storyController.createStory);
router.get('/stories', verifyToken, storyController.getActiveStories);
router.post('/stories/:storyId/view', verifyToken, storyController.recordStoryView);
router.get('/stories/:storyId/viewers', verifyToken, storyController.getStoryViewers);
router.delete('/stories/:storyId', verifyToken, storyController.deleteStory);

// --- Notifications Routes ---
router.get('/notifications', verifyToken, notificationController.getNotifications);
router.put('/notifications/mark-read', verifyToken, notificationController.markAllAsRead);

// --- Super Admin Portal Routes ---
router.get('/admin/stats', verifyToken, verifyAdmin, adminController.getSystemStats);
router.get('/admin/users', verifyToken, verifyAdmin, adminController.getAllUsers);
router.put('/admin/users/:userId/ban', verifyToken, verifyAdmin, adminController.toggleBanUser);
router.delete('/admin/users/:userId', verifyToken, verifyAdmin, adminController.deleteUser);
router.get('/admin/conversations', verifyToken, verifyAdmin, adminController.getAllConversations);
router.get('/admin/conversations/:conversationId/messages', verifyToken, verifyAdmin, adminController.getConversationMessages);

module.exports = router;
