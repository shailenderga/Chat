const db = require('../config/db');

// Create a new 24h story
exports.createStory = async (req, res) => {
  try {
    const userId = req.user.id;
    const { mediaType = 'image', mediaUrl, caption = '', bgGradient = 'from-purple-600 to-indigo-600' } = req.body;

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ');

    const [result] = await db.query(
      `INSERT INTO stories (user_id, media_type, media_url, caption, bg_gradient, expires_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [userId, mediaType, mediaUrl || null, caption, bgGradient, expiresAt]
    );

    res.status(201).json({
      message: 'Story posted successfully! It will expire in 24 hours.',
      storyId: result.insertId
    });
  } catch (error) {
    console.error('Create story error:', error);
    res.status(500).json({ message: 'Server error: ' + error.message });
  }
};

// Get all non-expired stories
exports.getActiveStories = async (req, res) => {
  try {
    const currentUserId = req.user?.id;

    const [rows] = await db.query(
      `SELECT s.*, u.name, u.username, u.avatar, u.story_privacy
       FROM stories s
       JOIN users u ON s.user_id = u.id
       WHERE s.expires_at > CURRENT_TIMESTAMP
       ORDER BY s.created_at ASC`
    );

    // Group stories by user and get view counts
    const userMap = {};
    for (const story of (rows || [])) {
      // Privacy Check
      if (story.user_id !== currentUserId) {
        if (story.story_privacy === 'nobody') {
          continue; // Creator hid stories from everyone
        }
        if (story.story_privacy === 'friends') {
          // Check mutual accepted friendship
          const [friendRows] = await db.query(
            `SELECT id FROM friend_requests 
             WHERE status = 'accepted' AND 
             ((sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?))`,
            [currentUserId, story.user_id, story.user_id, currentUserId]
          );
          if (!friendRows || friendRows.length === 0) {
            continue; // Not friends, skip
          }
        }
      }

      // Get views count
      const [viewRows] = await db.query(
        'SELECT viewer_id FROM story_views WHERE story_id = ?',
        [story.id]
      );

      const viewsCount = viewRows ? viewRows.length : 0;
      const hasViewed = viewRows ? viewRows.some(v => v.viewer_id === currentUserId) : false;

      const storyObj = {
        ...story,
        viewsCount,
        hasViewed
      };

      if (!userMap[story.user_id]) {
        userMap[story.user_id] = {
          userId: story.user_id,
          name: story.name,
          username: story.username,
          avatar: story.avatar,
          hasUnviewed: !hasViewed,
          stories: []
        };
      } else if (!hasViewed) {
        userMap[story.user_id].hasUnviewed = true;
      }

      userMap[story.user_id].stories.push(storyObj);
    }

    res.json(Object.values(userMap));
  } catch (error) {
    console.error('Get stories error:', error);
    res.status(500).json({ message: 'Server error: ' + error.message });
  }
};

// Record a view on a story ("kisne dekha")
exports.recordStoryView = async (req, res) => {
  try {
    const { storyId } = req.params;
    const viewerId = req.user.id;

    // Check if story exists and if viewer is the author
    const [storyRows] = await db.query('SELECT user_id FROM stories WHERE id = ?', [storyId]);
    if (!storyRows || storyRows.length === 0) {
      return res.status(404).json({ message: 'Story not found or expired' });
    }

    // Do not record author viewing their own story
    if (storyRows[0].user_id === viewerId) {
      return res.json({ message: 'Author view not recorded' });
    }

    // Check if already viewed
    const [existing] = await db.query(
      'SELECT id FROM story_views WHERE story_id = ? AND viewer_id = ?',
      [storyId, viewerId]
    );

    if (!existing || existing.length === 0) {
      await db.query(
        'INSERT INTO story_views (story_id, viewer_id) VALUES (?, ?)',
        [storyId, viewerId]
      );
    }

    res.json({ message: 'View recorded successfully' });
  } catch (error) {
    console.error('Record story view error:', error);
    res.status(500).json({ message: 'Server error: ' + error.message });
  }
};

// Get list of users who viewed a story ("kisne story dekha")
exports.getStoryViewers = async (req, res) => {
  try {
    const { storyId } = req.params;
    const userId = req.user.id;

    // Verify user owns the story or is admin
    const [storyRows] = await db.query('SELECT user_id FROM stories WHERE id = ?', [storyId]);
    if (!storyRows || storyRows.length === 0) {
      return res.status(404).json({ message: 'Story not found' });
    }

    if (storyRows[0].user_id !== userId && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Only the story author can see who viewed this story' });
    }

    // Fetch viewers details
    const [viewers] = await db.query(
      `SELECT sv.id, sv.viewed_at, u.id as user_id, u.name, u.username, u.avatar
       FROM story_views sv
       JOIN users u ON sv.viewer_id = u.id
       WHERE sv.story_id = ?
       ORDER BY sv.viewed_at DESC`,
      [storyId]
    );

    res.json(viewers || []);
  } catch (error) {
    console.error('Get story viewers error:', error);
    res.status(500).json({ message: 'Server error: ' + error.message });
  }
};

// Delete a story before 24h
exports.deleteStory = async (req, res) => {
  try {
    const { storyId } = req.params;
    const userId = req.user.id;

    // Verify ownership or admin
    const [storyRows] = await db.query('SELECT user_id FROM stories WHERE id = ?', [storyId]);
    if (!storyRows || storyRows.length === 0) {
      return res.status(404).json({ message: 'Story not found' });
    }

    if (storyRows[0].user_id !== userId && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Only the author or admin can delete this story' });
    }

    await db.query('DELETE FROM stories WHERE id = ?', [storyId]);

    res.json({ message: 'Story deleted successfully' });
  } catch (error) {
    console.error('Delete story error:', error);
    res.status(500).json({ message: 'Server error: ' + error.message });
  }
};
