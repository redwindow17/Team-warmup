/**
 * AI Service — Vertex AI Gemini Pro Integration
 * 
 * Service: Google Cloud Vertex AI (Gemini 1.5 Pro)
 * Features: Smart suggestions, delay detection, summarization, chat-to-task, general AI chat
 */

const { generateContent } = require('../config/vertexai');
const { db } = require('../config/firebase');
const { query } = require('../config/database');

async function getConversationHistory(userId, limit = 10) {
  const doc = await db.collection('aiConversations').doc(userId).get();
  if (!doc.exists) return [];
  return (doc.data().messages || []).slice(-limit);
}

async function saveConversationTurn(userId, userMsg, aiResp) {
  const ref = db.collection('aiConversations').doc(userId);
  const doc = await ref.get();
  const msgs = doc.exists ? (doc.data().messages || []) : [];
  msgs.push(
    { role: 'user', text: userMsg, timestamp: new Date().toISOString() },
    { role: 'model', text: aiResp, timestamp: new Date().toISOString() }
  );
  await ref.set({ messages: msgs.slice(-20), lastUpdated: new Date().toISOString() });
}

async function suggestNextActions(teamId, userId) {
  const r = await query(
    `SELECT t.title, t.status, t.priority, t.deadline, u.name as assignee_name
     FROM tasks t LEFT JOIN users u ON t.assignee_id = u.id
     WHERE t.team_id = $1 AND t.status != 'done' AND t.is_deleted = false
     ORDER BY CASE t.priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END
     LIMIT 20`, [teamId]
  );
  if (r.rows.length === 0) return { suggestions: 'All tasks completed!', taskCount: 0 };
  const ctx = r.rows.map(t => `- "${t.title}" | ${t.status} | ${t.priority} | ${t.assignee_name || 'Unassigned'} | Due: ${t.deadline ? new Date(t.deadline).toLocaleDateString() : 'None'}`).join('\n');
  const resp = await generateContent(`Analyze these tasks and suggest top 5 next actions:\n${ctx}\nToday: ${new Date().toLocaleDateString()}\nProvide prioritized, actionable items.`);
  return { suggestions: resp, taskCount: r.rows.length, generatedAt: new Date().toISOString() };
}

async function detectDelays(teamId) {
  const r = await query(
    `SELECT t.title, t.status, t.priority, t.deadline, u.name as assignee_name,
            EXTRACT(DAY FROM NOW() - t.deadline) as days_overdue
     FROM tasks t LEFT JOIN users u ON t.assignee_id = u.id
     WHERE t.team_id = $1 AND t.deadline < NOW() AND t.status != 'done' AND t.is_deleted = false`, [teamId]
  );
  if (r.rows.length === 0) return { analysis: 'No delays detected!', delayedCount: 0 };
  const ctx = r.rows.map(t => `- "${t.title}" | ${Math.round(t.days_overdue)}d overdue | ${t.assignee_name || 'Unassigned'}`).join('\n');
  const resp = await generateContent(`Analyze delayed tasks and recommend solutions:\n${ctx}\nProvide root causes, resolution plan, and prevention tips.`);
  return { analysis: resp, delayedCount: r.rows.length, generatedAt: new Date().toISOString() };
}

async function summarizeDailyWork(teamId, date = null) {
  const d = date || new Date().toISOString().split('T')[0];
  const completed = await query(`SELECT t.title, u.name as by FROM tasks t LEFT JOIN users u ON t.assignee_id = u.id WHERE t.team_id = $1 AND t.status = 'done' AND DATE(t.completed_at) = $2`, [teamId, d]);
  const stats = await query(`SELECT COUNT(*) FILTER (WHERE status = 'in_progress') as ip, COUNT(*) FILTER (WHERE status = 'todo') as todo, COUNT(*) FILTER (WHERE deadline < NOW() AND status != 'done') as overdue FROM tasks WHERE team_id = $1 AND is_deleted = false`, [teamId]);
  const ctx = `Completed: ${completed.rows.map(t => t.title).join(', ') || 'None'}\nIn Progress: ${stats.rows[0]?.ip || 0}\nOverdue: ${stats.rows[0]?.overdue || 0}`;
  const resp = await generateContent(`Create daily standup summary:\n${ctx}\nFormat: accomplishments, in progress, blockers, tomorrow's focus.`);
  return { summary: resp, date: d, stats: { completed: completed.rows.length, inProgress: parseInt(stats.rows[0]?.ip || 0) } };
}

async function convertChatToTasks(messages) {
  const text = messages.map(m => `${m.senderName}: ${m.text}`).join('\n');
  const resp = await generateContent(`Extract actionable tasks from conversation:\n${text}\nReturn JSON array: [{title, description, priority, suggestedAssignee}]`);
  try {
    const match = resp.match(/\[[\s\S]*\]/);
    if (match) return { tasks: JSON.parse(match[0]), rawAnalysis: resp };
  } catch (e) { /* parse failed */ }
  return { tasks: [], rawAnalysis: resp };
}

async function chat(userId, message, teamId = null) {
  const history = await getConversationHistory(userId);
  let prefix = '';
  if (teamId) {
    const s = await query(`SELECT COUNT(*) as t, COUNT(*) FILTER (WHERE status='done') as d, COUNT(*) FILTER (WHERE deadline<NOW() AND status!='done') as o FROM tasks WHERE team_id=$1 AND is_deleted=false`, [teamId]);
    prefix = `[Context: ${s.rows[0].t} tasks, ${s.rows[0].d} done, ${s.rows[0].o} overdue]\n`;
  }
  const resp = await generateContent(prefix + message, history);
  await saveConversationTurn(userId, message, resp);
  return { response: resp, timestamp: new Date().toISOString() };
}

module.exports = { suggestNextActions, detectDelays, summarizeDailyWork, convertChatToTasks, chat };
