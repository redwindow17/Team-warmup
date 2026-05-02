/**
 * Vertex AI Configuration — Gemini Pro Model
 * 
 * Service: Google Cloud Vertex AI
 * Model: Gemini Pro (gemini-1.5-pro)
 * Used for: AI assistant, task suggestions, summarization, delay detection
 */

const { VertexAI } = require('@google-cloud/vertexai');

const PROJECT_ID = process.env.VERTEX_AI_PROJECT || process.env.FIREBASE_PROJECT_ID || 'redwindow-482406';
const LOCATION = process.env.VERTEX_AI_LOCATION || 'us-central1';
const MODEL_ID = 'gemini-1.5-pro';

// Initialize Vertex AI client
const vertexAI = new VertexAI({
  project: PROJECT_ID,
  location: LOCATION
});

// SyncSphere AI system instructions
const SYSTEM_INSTRUCTION = `You are SyncSphere AI — an intelligent team coordination assistant.
Your role is to help teams work more efficiently by:

1. TASK MANAGEMENT: Suggest task priorities, identify blockers, recommend assignments
2. DELAY DETECTION: Analyze overdue tasks and recommend solutions
3. SUMMARIZATION: Create concise daily/weekly work summaries
4. CHAT ANALYSIS: Extract actionable tasks from team conversations
5. WORKFLOW SUGGESTIONS: Recommend automation rules based on team patterns

Guidelines:
- Be concise and actionable
- Use bullet points for clarity
- Prioritize by urgency and impact
- Consider team workload balance
- Suggest realistic deadlines
- Format responses in a structured way

When analyzing tasks, consider:
- Current task status and progress
- Team member availability
- Dependencies between tasks
- Historical completion patterns
- Upcoming deadlines`;

/**
 * Get the generative model with system instructions
 * @returns {Object} Gemini Pro generative model
 */
function getModel() {
  return vertexAI.getGenerativeModel({
    model: MODEL_ID,
    systemInstruction: SYSTEM_INSTRUCTION,
    generationConfig: {
      maxOutputTokens: 2048,
      temperature: 0.7,
      topP: 0.9,
      topK: 40
    },
    safetySettings: [
      {
        category: 'HARM_CATEGORY_HARASSMENT',
        threshold: 'BLOCK_MEDIUM_AND_ABOVE'
      },
      {
        category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
        threshold: 'BLOCK_MEDIUM_AND_ABOVE'
      }
    ]
  });
}

/**
 * Generate content with Gemini Pro
 * @param {string} prompt - User prompt
 * @param {Array} context - Previous conversation messages
 * @returns {string} AI response text
 */
async function generateContent(prompt, context = []) {
  try {
    const model = getModel();

    if (context.length > 0) {
      // Multi-turn conversation
      const chat = model.startChat({
        history: context.map(msg => ({
          role: msg.role,
          parts: [{ text: msg.text }]
        }))
      });
      const result = await chat.sendMessage(prompt);
      const response = result.response;
      return response.candidates[0].content.parts[0].text;
    } else {
      // Single prompt
      const result = await model.generateContent(prompt);
      const response = result.response;
      return response.candidates[0].content.parts[0].text;
    }
  } catch (error) {
    console.error('[Vertex AI] Generation error:', error.message);
    throw error;
  }
}

module.exports = {
  vertexAI,
  getModel,
  generateContent,
  SYSTEM_INSTRUCTION
};
