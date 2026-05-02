/**
 * AI Routes — Vertex AI Gemini Pro
 */

const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const aiService = require('../services/aiService');

router.use(authenticate);

// Get AI suggestions for next actions
router.post('/suggest', async (req, res) => {
  try {
    const result = await aiService.suggestNextActions(req.body.teamId, req.user.id);
    res.json(result);
  } catch (err) {
    console.error('[AI] Suggest error:', err);
    res.status(500).json({ error: 'AI suggestion failed' });
  }
});

// Detect delays
router.post('/detect-delays', async (req, res) => {
  try {
    const result = await aiService.detectDelays(req.body.teamId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Delay detection failed' });
  }
});

// Summarize daily work
router.post('/summarize', async (req, res) => {
  try {
    const result = await aiService.summarizeDailyWork(req.body.teamId, req.body.date);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Summarization failed' });
  }
});

// Convert chat to tasks
router.post('/chat-to-tasks', async (req, res) => {
  try {
    const result = await aiService.convertChatToTasks(req.body.messages);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Chat-to-task conversion failed' });
  }
});

// General AI chat
router.post('/chat', async (req, res) => {
  try {
    const result = await aiService.chat(req.user.id, req.body.message, req.body.teamId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'AI chat failed' });
  }
});

module.exports = router;
