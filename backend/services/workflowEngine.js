/**
 * @fileoverview Workflow Engine — Rule-Based Automation System
 * @module services/workflowEngine
 * @requires ../config/database
 * @requires ../config/firebase
 * @requires ./chatService
 * 
 * @description
 * Evaluates workflow triggers, checks conditions, and executes automated actions.
 * Supports rule-based automation for task management, notifications, and status updates.
 * 
 * @googleServices
 * - Cloud SQL: Workflow rules storage and task updates
 * - Firebase Cloud Messaging: Push notifications
 * - Cloud Firestore: In-app notifications
 * 
 * @features
 * - Trigger types: task_created, status_changed, task_completed, deadline_approaching, task_delayed
 * - Condition operators: equals, not_equals, contains, greater_than, less_than
 * - Action types: send_notification, update_status, auto_assign
 * - Automatic deadline checking every 30 minutes
 * 
 * @example
 * // Trigger workflows when a task is created
 * await triggerWorkflows('team-123', 'task_created', {
 *   taskId: 'task-456',
 *   title: 'Build login page',
 *   assigneeId: 'user-789',
 *   priority: 'high'
 * });
 */

const { query } = require('../config/database');
const { sendPushNotification } = require('../config/firebase');
const { createNotification } = require('./chatService');

/**
 * Deadline check interval in milliseconds (30 minutes)
 * @constant {number}
 */
const DEADLINE_CHECK_INTERVAL = 30 * 60 * 1000;

/**
 * Retrieve active workflows for a team and trigger type
 * 
 * @async
 * @param {string} teamId - Team UUID
 * @param {string} triggerType - Workflow trigger type (task_created, status_changed, etc.)
 * @returns {Promise<Array<Object>>} Array of active workflow objects from Cloud SQL
 * @throws {Error} If database query fails
 * 
 * @googleService Cloud SQL (PostgreSQL)
 */
async function getActiveWorkflows(teamId, triggerType) {
  const r = await query(
    `SELECT * FROM workflows WHERE team_id = $1 AND trigger_type = $2 AND enabled = true`,
    [teamId, triggerType]
  );
  return r.rows;
}

function evaluateConditions(conditions, context) {
  if (!conditions || conditions.length === 0) return true;
  return conditions.every(c => {
    const value = context[c.field];
    switch (c.operator) {
      case 'equals': return value === c.value;
      case 'not_equals': return value !== c.value;
      case 'contains': return String(value).includes(c.value);
      case 'greater_than': return Number(value) > Number(c.value);
      case 'less_than': return Number(value) < Number(c.value);
      default: return true;
    }
  });
}

async function executeActions(actions, context) {
  const results = [];
  for (const action of actions) {
    try {
      switch (action.type) {
        case 'send_notification': {
          if (context.assigneeId) {
            const userResult = await query('SELECT fcm_token FROM users WHERE id = $1', [context.assigneeId]);
            const token = userResult.rows[0]?.fcm_token;
            if (token) {
              await sendPushNotification(token, action.title || 'SyncSphere Alert', action.message || context.description);
            }
            await createNotification(context.assigneeId, {
              title: action.title || 'Workflow Alert',
              body: action.message || context.description,
              type: 'workflow',
              link: `/tasks/${context.taskId}`
            });
          }
          results.push({ action: 'send_notification', status: 'sent' });
          break;
        }
        case 'update_status': {
          if (context.taskId && action.newStatus) {
            await query('UPDATE tasks SET status = $1 WHERE id = $2', [action.newStatus, context.taskId]);
            results.push({ action: 'update_status', status: 'updated', newStatus: action.newStatus });
          }
          break;
        }
        case 'auto_assign': {
          if (context.taskId && action.assigneeId) {
            await query('UPDATE tasks SET assignee_id = $1 WHERE id = $2', [action.assigneeId, context.taskId]);
            results.push({ action: 'auto_assign', status: 'assigned' });
          }
          break;
        }
        default:
          results.push({ action: action.type, status: 'unknown_action' });
      }
    } catch (err) {
      results.push({ action: action.type, status: 'error', error: err.message });
    }
  }
  return results;
}

async function triggerWorkflows(teamId, triggerType, context) {
  const workflows = await getActiveWorkflows(teamId, triggerType);
  const results = [];
  for (const wf of workflows) {
    const conditions = typeof wf.conditions === 'string' ? JSON.parse(wf.conditions) : wf.conditions;
    const actions = typeof wf.actions === 'string' ? JSON.parse(wf.actions) : wf.actions;
    if (evaluateConditions(conditions, context)) {
      const actionResults = await executeActions(actions, context);
      await query('UPDATE workflows SET last_run = NOW(), run_count = run_count + 1 WHERE id = $1', [wf.id]);
      results.push({ workflowId: wf.id, name: wf.name, actions: actionResults });
    }
  }
  return results;
}

async function checkDeadlines() {
  const r = await query(
    `SELECT t.id, t.title, t.team_id, t.assignee_id, t.deadline,
            EXTRACT(HOUR FROM t.deadline - NOW()) as hours_remaining
     FROM tasks t
     WHERE t.deadline BETWEEN NOW() AND NOW() + INTERVAL '24 hours'
       AND t.status != 'done' AND t.is_deleted = false`
  );
  for (const task of r.rows) {
    await triggerWorkflows(task.team_id, 'deadline_approaching', {
      taskId: task.id, title: task.title, assigneeId: task.assignee_id,
      description: `Task "${task.title}" is due in ${Math.round(task.hours_remaining)} hours`
    });
  }
  return r.rows.length;
}

// Run deadline checks every 30 minutes
if (process.env.NODE_ENV !== 'test') {
  setInterval(checkDeadlines, 30 * 60 * 1000);
}

module.exports = { triggerWorkflows, checkDeadlines, evaluateConditions, executeActions };
