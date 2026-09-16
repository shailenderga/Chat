const db = require('../config/db');

// Get user notifications
exports.getNotifications = async (req, res) => {
  try {
    const userId = req.user.id;
    const [notifs] = await db.query(
      'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50',
      [userId]
    );

    const formatted = (notifs || []).map(n => {
      let metadata = null;
      try {
        metadata = typeof n.metadata === 'string' ? JSON.parse(n.metadata) : n.metadata;
      } catch (e) {
        metadata = n.metadata;
      }
      return {
        ...n,
        metadata
      };
    });

    res.json(formatted);
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ message: 'Server error: ' + error.message });
  }
};

// Mark all as read
exports.markAllAsRead = async (req, res) => {
  try {
    const userId = req.user.id;
    await db.query('UPDATE notifications SET is_read = TRUE WHERE user_id = ?', [userId]);
    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    console.error('Mark read notifications error:', error);
    res.status(500).json({ message: 'Server error: ' + error.message });
  }
};
