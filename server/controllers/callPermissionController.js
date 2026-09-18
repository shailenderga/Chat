const db = require('../config/db');

// Get call permission status between current user and partner
exports.getPermissionStatus = async (req, res) => {
  try {
    const userId = req.user.id;
    const { partnerId } = req.params;

    // My permission given to partner
    const [myPerm] = await db.query(
      'SELECT audio_allowed, video_allowed FROM call_permissions WHERE user_id = ? AND target_user_id = ?',
      [userId, partnerId]
    );

    // Partner's permission given to me
    const [theirPerm] = await db.query(
      'SELECT audio_allowed, video_allowed FROM call_permissions WHERE user_id = ? AND target_user_id = ?',
      [partnerId, userId]
    );

    const myAudio = myPerm.length === 0 ? true : Boolean(myPerm[0].audio_allowed);
    const myVideo = myPerm.length === 0 ? true : Boolean(myPerm[0].video_allowed);

    const theirAudio = theirPerm.length === 0 ? true : Boolean(theirPerm[0].audio_allowed);
    const theirVideo = theirPerm.length === 0 ? true : Boolean(theirPerm[0].video_allowed);

    const mutualAudioAllowed = myAudio && theirAudio;
    const mutualVideoAllowed = myVideo && theirVideo;

    res.json({
      myAudio,
      myVideo,
      theirAudio,
      theirVideo,
      mutualAudioAllowed,
      mutualVideoAllowed
    });
  } catch (error) {
    console.error('Get permission status error:', error);
    res.status(500).json({ message: 'Server error: ' + error.message });
  }
};

// Grant or update call permissions
exports.updatePermission = async (req, res) => {
  try {
    const userId = req.user.id;
    const { targetUserId, audioAllowed, videoAllowed } = req.body;

    if (!targetUserId) {
      return res.status(400).json({ message: 'Target user ID is required' });
    }

    const [existing] = await db.query(
      'SELECT id FROM call_permissions WHERE user_id = ? AND target_user_id = ?',
      [userId, targetUserId]
    );

    if (existing && existing.length > 0) {
      await db.query(
        'UPDATE call_permissions SET audio_allowed = ?, video_allowed = ? WHERE user_id = ? AND target_user_id = ?',
        [Boolean(audioAllowed), Boolean(videoAllowed), userId, targetUserId]
      );
    } else {
      await db.query(
        'INSERT INTO call_permissions (user_id, target_user_id, audio_allowed, video_allowed) VALUES (?, ?, ?, ?)',
        [userId, targetUserId, Boolean(audioAllowed), Boolean(videoAllowed)]
      );
    }

    // Check if both now allowed
    const [theirPerm] = await db.query(
      'SELECT audio_allowed, video_allowed FROM call_permissions WHERE user_id = ? AND target_user_id = ?',
      [targetUserId, userId]
    );

    const mutualAudio = Boolean(audioAllowed) && Boolean(theirPerm?.[0]?.audio_allowed);
    const mutualVideo = Boolean(videoAllowed) && Boolean(theirPerm?.[0]?.video_allowed);

    // Notify partner that permission was updated
    await db.query(
      'INSERT INTO notifications (user_id, type, title, content, metadata) VALUES (?, ?, ?, ?, ?)',
      [
        targetUserId,
        'call_permission',
        'Call Permission Updated',
        `@${req.user.username} updated call permissions with you (Audio: ${audioAllowed ? 'Allowed' : 'Off'}, Video: ${videoAllowed ? 'Allowed' : 'Off'})`,
        JSON.stringify({ fromUserId: userId, audioAllowed, videoAllowed, mutualAudio, mutualVideo })
      ]
    );

    res.json({
      message: 'Call permission updated',
      audioAllowed: Boolean(audioAllowed),
      videoAllowed: Boolean(videoAllowed),
      mutualAudioAllowed: mutualAudio,
      mutualVideoAllowed: mutualVideo
    });
  } catch (error) {
    console.error('Update permission error:', error);
    res.status(500).json({ message: 'Server error: ' + error.message });
  }
};

// Send a formal request asking partner for call permission
exports.requestPermission = async (req, res) => {
  try {
    const userId = req.user.id;
    const { targetUserId, callType = 'video' } = req.body;

    await db.query(
      'INSERT INTO notifications (user_id, type, title, content, metadata) VALUES (?, ?, ?, ?, ?)',
      [
        targetUserId,
        'call_permission',
        `Call Permission Requested`,
        `@${req.user.username} wants to enable ${callType} calling with you. Grant permission to call.`,
        JSON.stringify({ requesterId: userId, callType })
      ]
    );

    res.json({ message: 'Call permission request sent to partner' });
  } catch (error) {
    console.error('Request permission error:', error);
    res.status(500).json({ message: 'Server error: ' + error.message });
  }
};
