/**
 * Chat Routes — Cloud Firestore Real-Time
 */

const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const chatService = require('../services/chatService');

router.use(authenticate);

// Create channel
router.post('/channels', async (req, res) => {
  try {
    const channel = await chatService.createChannel({
      ...req.body,
      createdBy: req.user.id,
      members: [...(req.body.members || []), req.user.id]
    });
    req.app.get('io').to(`team:${req.body.teamId}`).emit('channel-created', channel);
    res.status(201).json(channel);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create channel' });
  }
});

// Get channels
router.get('/channels/:teamId', async (req, res) => {
  try {
    const channels = await chatService.getChannels(req.params.teamId, req.user.id);
    res.json(channels);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch channels' });
  }
});

// Send message
router.post('/messages', async (req, res) => {
  try {
    const message = await chatService.sendMessage({
      ...req.body,
      senderId: req.user.id,
      senderName: req.user.name,
      senderAvatar: req.user.avatar_url
    });
    req.app.get('io').to(`channel:${req.body.channelId}`).emit('new-message', message);
    res.status(201).json(message);
  } catch (err) {
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// Get messages
router.get('/messages/:channelId', async (req, res) => {
  try {
    const messages = await chatService.getMessages(
      req.params.channelId,
      parseInt(req.query.limit) || 50,
      req.query.before
    );
    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// Add reaction
router.post('/messages/:channelId/:messageId/react', async (req, res) => {
  try {
    await chatService.addReaction(req.params.channelId, req.params.messageId, req.user.id, req.body.emoji);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to add reaction' });
  }
});

// Toggle pin
router.post('/messages/:channelId/:messageId/pin', async (req, res) => {
  try {
    const result = await chatService.togglePin(req.params.channelId, req.params.messageId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Failed to toggle pin' });
  }
});

module.exports = router;
