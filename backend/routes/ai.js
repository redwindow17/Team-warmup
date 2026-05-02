/**
 * @fileoverview AI Routes — Vertex AI Gemini Pro Integration
 * @module routes/ai
 * @requires express
 * @requires ../middleware/auth
 * @requires ../services/aiService
 * 
 * @description
 * RESTful API endpoints for AI-powered features using Google Vertex AI.
 * All routes require Firebase Authentication and have rate limiting applied.
 * 
 * @googleServices
 * - Vertex AI (Gemini 1.5 Pro): Content generation and analysis
 * - Cloud SQL: Task data retrieval for context
 * - Cloud Firestore: Conversation history storage
 * 
 * @security
 * - Firebase Auth token required for all endpoints
 * - Rate limiting: 30 requests per 15 minutes per user
 * - Input sanitization via service layer
 * 
 * @rateLimit 30 requests per 15 minutes (configured in server.js)
 */

const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const aiService = require('../services/aiService');

router.use(authenticate);

/**
 * @route POST /api/ai/suggest
 * @desc Get AI-powered suggestions for next actions based on team's incomplete tasks
 * @access Private (requires authentication, rate limited)
 * @param {Object} req.body
 * @param {string} req.body.teamId - Team ID (UUID, required)
 * @returns {Object} 200 - AI suggestions with task count and timestamp
 * @returns {Object} 400 - Missing or invalid teamId
 * @returns {Object} 500 - AI service error
 * 
 * @example
 * POST /api/ai/suggest
 * Body: { "teamId": "550e8400-e29b-41d4-a716-446655440000" }
 * Response: {
 *   "suggestions": "1. Focus on the login page task...",
 *   "taskCount": 5,
 *   "generatedAt": "2026-05-02T14:30:00.000Z"
 * }
 */
router.post('/suggest', async (req, res) => {
  try {
    if (!req.body.teamId) {
      return res.status(400).json({ 
        error: 'Missing required field',
        message: 'teamId is required in request body'
      });
    }
    
    const result = await aiService.suggestNextActions(req.body.teamId, req.user.id);
    res.json(result);
  } catch (err) {
    console.error('[AI] Suggest error:', err);
    res.status(500).json({ 
      error: 'AI suggestion failed',
      message: err.message || 'An unexpected error occurred while generating suggestions'
    });
  }
});

/**
 * @route POST /api/ai/detect-delays
 * @desc Detect overdue tasks and get AI analysis with recommendations
 * @access Private (requires authentication, rate limited)
 * @param {Object} req.body
 * @param {string} req.body.teamId - Team ID (UUID, required)
 * @returns {Object} 200 - Delay analysis with overdue count
 * @returns {Object} 400 - Missing or invalid teamId
 * @returns {Object} 500 - AI service error
 */
router.post('/detect-delays', async (req, res) => {
  try {
    if (!req.body.teamId) {
      return res.status(400).json({ 
        error: 'Missing required field',
        message: 'teamId is required in request body'
      });
    }
    
    const result = await aiService.detectDelays(req.body.teamId);
    res.json(result);
  } catch (err) {
    console.error('[AI] Detect delays error:', err);
    res.status(500).json({ 
      error: 'Delay detection failed',
      message: err.message || 'An unexpected error occurred while detecting delays'
    });
  }
});

/**
 * @route POST /api/ai/summarize
 * @desc Generate daily work summary for a team
 * @access Private (requires authentication, rate limited)
 * @param {Object} req.body
 * @param {string} req.body.teamId - Team ID (UUID, required)
 * @param {string} [req.body.date] - Date to summarize (ISO 8601, defaults to today)
 * @returns {Object} 200 - Daily summary with statistics
 * @returns {Object} 400 - Missing or invalid teamId
 * @returns {Object} 500 - AI service error
 */
router.post('/summarize', async (req, res) => {
  try {
    if (!req.body.teamId) {
      return res.status(400).json({ 
        error: 'Missing required field',
        message: 'teamId is required in request body'
      });
    }
    
    const result = await aiService.summarizeDailyWork(req.body.teamId, req.body.date);
    res.json(result);
  } catch (err) {
    console.error('[AI] Summarize error:', err);
    res.status(500).json({ 
      error: 'Summarization failed',
      message: err.message || 'An unexpected error occurred while generating summary'
    });
  }
});

/**
 * @route POST /api/ai/chat-to-tasks
 * @desc Extract actionable tasks from chat conversation using AI
 * @access Private (requires authentication, rate limited)
 * @param {Object} req.body
 * @param {Array<Object>} req.body.messages - Array of chat messages (required)
 * @param {string} req.body.messages[].senderName - Sender name
 * @param {string} req.body.messages[].text - Message text
 * @returns {Object} 200 - Extracted tasks array with raw analysis
 * @returns {Object} 400 - Missing or invalid messages
 * @returns {Object} 500 - AI service error
 */
router.post('/chat-to-tasks', async (req, res) => {
  try {
    if (!req.body.messages || !Array.isArray(req.body.messages) || req.body.messages.length === 0) {
      return res.status(400).json({ 
        error: 'Invalid input',
        message: 'messages array is required and must not be empty'
      });
    }
    
    const result = await aiService.convertChatToTasks(req.body.messages);
    res.json(result);
  } catch (err) {
    console.error('[AI] Chat-to-tasks error:', err);
    res.status(500).json({ 
      error: 'Chat-to-task conversion failed',
      message: err.message || 'An unexpected error occurred while converting chat to tasks'
    });
  }
});

/**
 * @route POST /api/ai/chat
 * @desc General AI chat with conversation history and team context
 * @access Private (requires authentication, rate limited)
 * @param {Object} req.body
 * @param {string} req.body.message - User message (required)
 * @param {string} [req.body.teamId] - Team ID for context (UUID, optional)
 * @returns {Object} 200 - AI response with timestamp
 * @returns {Object} 400 - Missing or invalid message
 * @returns {Object} 500 - AI service error
 * 
 * @description
 * Maintains conversation history per user in Cloud Firestore.
 * When teamId is provided, includes team task statistics in context.
 */
router.post('/chat', async (req, res) => {
  try {
    if (!req.body.message || typeof req.body.message !== 'string' || req.body.message.trim().length === 0) {
      return res.status(400).json({ 
        error: 'Invalid input',
        message: 'message is required and must be a non-empty string'
      });
    }
    
    const result = await aiService.chat(req.user.id, req.body.message, req.body.teamId);
    res.json(result);
  } catch (err) {
    console.error('[AI] Chat error:', err);
    res.status(500).json({ 
      error: 'AI chat failed',
      message: err.message || 'An unexpected error occurred during AI chat'
    });
  }
});

module.exports = router;
