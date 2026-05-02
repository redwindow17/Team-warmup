/**
 * Notification Service — Firebase Cloud Messaging
 */

const { sendPushNotification } = require('../config/firebase');
const { createNotification } = require('./chatService');
const { query } = require('../config/database');

async function notifyUser(userId, title, body, data = {}) {
  const r = await query('SELECT fcm_token FROM users WHERE id = $1', [userId]);
  const token = r.rows[0]?.fcm_token;
  if (token) {
    try { await sendPushNotification(token, title, body, data); } catch (e) { console.warn('[FCM] Push failed:', e.message); }
  }
  await createNotification(userId, { title, body, type: data.type || 'info', link: data.link });
}

async function notifyTeam(teamId, title, body, excludeUserId = null) {
  const r = await query('SELECT user_id FROM team_members WHERE team_id = $1', [teamId]);
  for (const row of r.rows) {
    if (row.user_id !== excludeUserId) {
      await notifyUser(row.user_id, title, body, { teamId });
    }
  }
}

module.exports = { notifyUser, notifyTeam };
