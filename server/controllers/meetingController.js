const db = require('../config/db');
const { v4: uuidv4 } = require('uuid');

// Create a new meeting room
exports.createMeeting = async (req, res) => {
  try {
    const userId = req.user.id;
    const { title = 'Team Video Meeting' } = req.body;

    const roomId = 'room-' + uuidv4().slice(0, 8) + '-' + Math.floor(1000 + Math.random() * 9000);

    await db.query(
      'INSERT INTO meeting_rooms (id, host_id, title, is_active) VALUES (?, ?, ?, TRUE)',
      [roomId, userId, title]
    );

    res.status(201).json({
      message: 'Meeting room created',
      roomId,
      title,
      hostId: userId,
      joinUrl: `/meet/${roomId}`
    });
  } catch (error) {
    console.error('Create meeting error:', error);
    res.status(500).json({ message: 'Server error: ' + error.message });
  }
};

// Get meeting details
exports.getMeeting = async (req, res) => {
  try {
    const { roomId } = req.params;

    const [rooms] = await db.query(
      `SELECT m.*, u.name as host_name, u.username as host_username, u.avatar as host_avatar
       FROM meeting_rooms m
       JOIN users u ON m.host_id = u.id
       WHERE m.id = ?`,
      [roomId]
    );

    if (!rooms || rooms.length === 0) {
      return res.status(404).json({ message: 'Meeting room not found or expired' });
    }

    const room = rooms[0];
    if (!room.is_active) {
      return res.status(400).json({ message: 'This meeting has ended' });
    }

    res.json(room);
  } catch (error) {
    console.error('Get meeting error:', error);
    res.status(500).json({ message: 'Server error: ' + error.message });
  }
};

// End meeting
exports.endMeeting = async (req, res) => {
  try {
    const { roomId } = req.params;
    const userId = req.user.id;

    const [rooms] = await db.query('SELECT host_id FROM meeting_rooms WHERE id = ?', [roomId]);
    if (!rooms || rooms.length === 0) {
      return res.status(404).json({ message: 'Meeting not found' });
    }

    if (rooms[0].host_id !== userId && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Only the host or admin can end the meeting' });
    }

    await db.query('UPDATE meeting_rooms SET is_active = FALSE WHERE id = ?', [roomId]);

    res.json({ message: 'Meeting ended successfully' });
  } catch (error) {
    console.error('End meeting error:', error);
    res.status(500).json({ message: 'Server error: ' + error.message });
  }
};
