const { AccessToken } = require('livekit-server-sdk');

exports.generateToken = async (req, res) => {
  try {
    const { roomName, participantName } = req.body;

    if (!roomName || !participantName) {
      return res.status(400).json({ error: 'roomName and participantName are required' });
    }

    // Retrieve keys from environment
    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;

    if (!apiKey || !apiSecret) {
      return res.status(500).json({ error: 'Server LiveKit configuration is missing' });
    }

    // Create a new Access Token
    const at = new AccessToken(apiKey, apiSecret, {
      identity: req.user.id.toString(), // The unique database ID of the user
      name: participantName,            // The display name shown in the call
    });

    // Grant permissions
    at.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: true,       // Allow them to use mic/camera
      canSubscribe: true,     // Allow them to see/hear others
      canPublishData: true    // Allow sending in-call chat/reactions
    });

    // Generate the JWT
    const token = await at.toJwt();

    res.status(200).json({ token });
  } catch (error) {
    console.error('Error generating LiveKit token:', error);
    res.status(500).json({ error: 'Failed to generate token' });
  }
};