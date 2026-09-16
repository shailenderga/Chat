const db = require('../config/db');

// Send friend request
exports.sendRequest = async (req, res) => {
  try {
    const { receiverId } = req.body;
    const senderId = req.user.id;

    if (!receiverId) {
      return res.status(400).json({ message: 'Receiver ID is required' });
    }

    if (Number(receiverId) === Number(senderId)) {
      return res.status(400).json({ message: 'You cannot send a friend request to yourself' });
    }

    // Check if receiver exists
    const [receivers] = await db.query('SELECT id, name, username FROM users WHERE id = ?', [receiverId]);
    if (!receivers || receivers.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check existing request
    const [existing] = await db.query(
      'SELECT id, status FROM friend_requests WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)',
      [senderId, receiverId, receiverId, senderId]
    );

    if (existing && existing.length > 0) {
      const status = existing[0].status;
      if (status === 'accepted') {
        return res.status(400).json({ message: 'You are already connected with this user' });
      } else if (status === 'pending') {
        return res.status(400).json({ message: 'A friend request is already pending between you' });
      }
    }

    const [result] = await db.query(
      'INSERT INTO friend_requests (sender_id, receiver_id, status) VALUES (?, ?, "pending")',
      [senderId, receiverId]
    );

    // Create a notification for the receiver
    await db.query(
      'INSERT INTO notifications (user_id, type, title, content, metadata) VALUES (?, "request", ?, ?, ?)',
      [
        receiverId,
        'New Friend Request',
        `@${req.user.username} (${req.user.name}) sent you a chat request`,
        JSON.stringify({ requestId: result.insertId, senderId })
      ]
    );

    res.status(201).json({
      message: 'Friend request sent successfully',
      requestId: result.insertId
    });
  } catch (error) {
    console.error('Send request error:', error);
    res.status(500).json({ message: 'Server error: ' + error.message });
  }
};

// Accept friend request
exports.acceptRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const userId = req.user.id;

    // Find the request
    const [requests] = await db.query(
      'SELECT * FROM friend_requests WHERE id = ? AND receiver_id = ?',
      [requestId, userId]
    );

    if (!requests || requests.length === 0) {
      return res.status(404).json({ message: 'Friend request not found or not authorized' });
    }

    const request = requests[0];
    if (request.status === 'accepted') {
      return res.status(400).json({ message: 'Request has already been accepted' });
    }

    // Update status to accepted
    await db.query('UPDATE friend_requests SET status = "accepted" WHERE id = ?', [requestId]);

    // Check or create conversation
    const [existingConvo] = await db.query(
      'SELECT id FROM conversations WHERE (user1_id = ? AND user2_id = ?) OR (user1_id = ? AND user2_id = ?)',
      [request.sender_id, request.receiver_id, request.receiver_id, request.sender_id]
    );

    let conversationId;
    if (existingConvo && existingConvo.length > 0) {
      conversationId = existingConvo[0].id;
    } else {
      const [newConvo] = await db.query(
        'INSERT INTO conversations (user1_id, user2_id) VALUES (?, ?)',
        [request.sender_id, request.receiver_id]
      );
      conversationId = newConvo.insertId;

      // Seed initial welcoming message
      await db.query(
        'INSERT INTO messages (conversation_id, sender_id, message_type, content) VALUES (?, ?, "text", ?)',
        [conversationId, userId, "Hi! I accepted your request. Let's chat!"]
      );
    }

    // Notify sender that their request was accepted
    await db.query(
      'INSERT INTO notifications (user_id, type, title, content, metadata) VALUES (?, "request", ?, ?, ?)',
      [
        request.sender_id,
        'Friend Request Accepted',
        `@${req.user.username} accepted your request! You can now chat and call.`,
        JSON.stringify({ conversationId, acceptedBy: userId })
      ]
    );

    res.json({
      message: 'Friend request accepted! Conversation unlocked.',
      conversationId
    });
  } catch (error) {
    console.error('Accept request error:', error);
    res.status(500).json({ message: 'Server error: ' + error.message });
  }
};

// Reject / Decline friend request
exports.rejectRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const userId = req.user.id;

    const [requests] = await db.query(
      'SELECT * FROM friend_requests WHERE id = ? AND receiver_id = ?',
      [requestId, userId]
    );

    if (!requests || requests.length === 0) {
      return res.status(404).json({ message: 'Friend request not found' });
    }

    await db.query('UPDATE friend_requests SET status = "rejected" WHERE id = ?', [requestId]);

    res.json({ message: 'Friend request declined' });
  } catch (error) {
    console.error('Reject request error:', error);
    res.status(500).json({ message: 'Server error: ' + error.message });
  }
};

// Get all incoming and outgoing requests
exports.getRequests = async (req, res) => {
  try {
    const userId = req.user.id;

    // Incoming pending requests
    const [incomingRows] = await db.query(
      `SELECT fr.id, fr.sender_id, fr.receiver_id, fr.status, fr.created_at,
              u.name as sender_name, u.username as sender_username, u.avatar as sender_avatar, u.bio as sender_bio
       FROM friend_requests fr
       JOIN users u ON fr.sender_id = u.id
       WHERE fr.receiver_id = ? AND fr.status = 'pending'
       ORDER BY fr.created_at DESC`,
      [userId]
    );

    // Outgoing pending requests
    const [outgoingRows] = await db.query(
      `SELECT fr.id, fr.sender_id, fr.receiver_id, fr.status, fr.created_at,
              u.name as receiver_name, u.username as receiver_username, u.avatar as receiver_avatar
       FROM friend_requests fr
       JOIN users u ON fr.receiver_id = u.id
       WHERE fr.sender_id = ? AND fr.status = 'pending'
       ORDER BY fr.created_at DESC`,
      [userId]
    );

    res.json({
      incoming: incomingRows || [],
      outgoing: outgoingRows || []
    });
  } catch (error) {
    console.error('Get requests error:', error);
    res.status(500).json({ message: 'Server error: ' + error.message });
  }
};
