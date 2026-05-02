/**
 * Task Service — Cloud SQL PostgreSQL Operations
 * 
 * All task CRUD operations backed by Google Cloud SQL.
 * Events logged to Google BigQuery for analytics.
 */

const { query, transaction } = require('../config/database');
const { logTaskEvent } = require('../config/bigquery');
const { paginate } = require('../utils/helpers');

/**
 * Create a new task
 */
async function createTask(taskData, userId) {
  const result = await query(
    `INSERT INTO tasks (title, description, status, priority, assignee_id, team_id, created_by, deadline, tags, workflow_group)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING *`,
    [
      taskData.title,
      taskData.description || null,
      taskData.status || 'todo',
      taskData.priority || 'medium',
      taskData.assigneeId || null,
      taskData.teamId,
      userId,
      taskData.deadline || null,
      taskData.tags || [],
      taskData.workflowGroup || null
    ]
  );

  const task = result.rows[0];

  // Log event to BigQuery (non-blocking)
  logTaskEvent({
    type: 'task_created',
    taskId: task.id,
    userId,
    teamId: task.team_id,
    newStatus: task.status,
    priority: task.priority
  });

  // Log activity to Cloud SQL
  await query(
    `INSERT INTO activities (type, user_id, user_name, team_id, description, metadata)
     VALUES ('task_created', $1, $2, $3, $4, $5)`,
    [userId, '', task.team_id, `Created task: ${task.title}`, JSON.stringify({ taskId: task.id })]
  );

  return task;
}

/**
 * Get tasks with filters, pagination, and sorting
 */
async function getTasks(teamId, filters = {}) {
  const { offset, limit, page } = paginate(filters.page, filters.limit);
  const conditions = ['t.team_id = $1', 't.is_deleted = false'];
  const params = [teamId];
  let paramIndex = 2;

  if (filters.status) {
    conditions.push(`t.status = $${paramIndex}`);
    params.push(filters.status);
    paramIndex++;
  }

  if (filters.priority) {
    conditions.push(`t.priority = $${paramIndex}`);
    params.push(filters.priority);
    paramIndex++;
  }

  if (filters.assigneeId) {
    conditions.push(`t.assignee_id = $${paramIndex}`);
    params.push(filters.assigneeId);
    paramIndex++;
  }

  if (filters.search) {
    conditions.push(`(t.title ILIKE $${paramIndex} OR t.description ILIKE $${paramIndex})`);
    params.push(`%${filters.search}%`);
    paramIndex++;
  }

  const where = conditions.join(' AND ');
  const orderBy = filters.sortBy === 'deadline' ? 't.deadline ASC NULLS LAST'
    : filters.sortBy === 'priority' ? "CASE t.priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END"
    : 't.created_at DESC';

  // Get total count
  const countResult = await query(
    `SELECT COUNT(*) FROM tasks t WHERE ${where}`,
    params
  );
  const total = parseInt(countResult.rows[0].count);

  // Get paginated results with assignee info
  params.push(limit, offset);
  const result = await query(
    `SELECT t.*, u.name as assignee_name, u.avatar_url as assignee_avatar,
            c.name as creator_name
     FROM tasks t
     LEFT JOIN users u ON t.assignee_id = u.id
     LEFT JOIN users c ON t.created_by = c.id
     WHERE ${where}
     ORDER BY ${orderBy}
     LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
    params
  );

  return {
    tasks: result.rows,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  };
}

/**
 * Get a single task by ID
 */
async function getTaskById(taskId) {
  const result = await query(
    `SELECT t.*, u.name as assignee_name, u.avatar_url as assignee_avatar,
            c.name as creator_name
     FROM tasks t
     LEFT JOIN users u ON t.assignee_id = u.id
     LEFT JOIN users c ON t.created_by = c.id
     WHERE t.id = $1 AND t.is_deleted = false`,
    [taskId]
  );
  return result.rows[0] || null;
}

/**
 * Update a task
 */
async function updateTask(taskId, updates, userId) {
  // Get current task state for event logging
  const current = await getTaskById(taskId);
  if (!current) return null;

  const fields = [];
  const values = [];
  let idx = 1;

  const allowedFields = {
    title: 'title', description: 'description', status: 'status',
    priority: 'priority', assigneeId: 'assignee_id', deadline: 'deadline',
    tags: 'tags', workflowGroup: 'workflow_group'
  };

  for (const [key, column] of Object.entries(allowedFields)) {
    if (updates[key] !== undefined) {
      fields.push(`${column} = $${idx}`);
      values.push(updates[key]);
      idx++;
    }
  }

  // Mark completed_at when status changes to done
  if (updates.status === 'done' && current.status !== 'done') {
    fields.push(`completed_at = NOW()`);
  }

  if (fields.length === 0) return current;

  values.push(taskId);
  const result = await query(
    `UPDATE tasks SET ${fields.join(', ')} WHERE id = $${idx} AND is_deleted = false RETURNING *`,
    values
  );

  const updated = result.rows[0];

  // Log status change to BigQuery
  if (updates.status && updates.status !== current.status) {
    logTaskEvent({
      type: 'status_changed',
      taskId,
      userId,
      teamId: current.team_id,
      oldStatus: current.status,
      newStatus: updates.status,
      priority: current.priority
    });
  }

  return updated;
}

/**
 * Soft delete a task
 */
async function deleteTask(taskId, userId) {
  const result = await query(
    `UPDATE tasks SET is_deleted = true WHERE id = $1 RETURNING *`,
    [taskId]
  );

  if (result.rows[0]) {
    logTaskEvent({
      type: 'task_deleted',
      taskId,
      userId,
      teamId: result.rows[0].team_id
    });
  }

  return result.rows[0];
}

/**
 * Get task statistics for a team
 */
async function getTaskStats(teamId) {
  const result = await query(
    `SELECT
       COUNT(*) FILTER (WHERE status = 'todo') as todo_count,
       COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress_count,
       COUNT(*) FILTER (WHERE status = 'review') as review_count,
       COUNT(*) FILTER (WHERE status = 'done') as done_count,
       COUNT(*) FILTER (WHERE deadline < NOW() AND status != 'done') as overdue_count,
       COUNT(*) as total
     FROM tasks
     WHERE team_id = $1 AND is_deleted = false`,
    [teamId]
  );
  return result.rows[0];
}

/**
 * Get overdue tasks for a team (used by workflow engine)
 */
async function getOverdueTasks(teamId) {
  const result = await query(
    `SELECT t.*, u.name as assignee_name
     FROM tasks t
     LEFT JOIN users u ON t.assignee_id = u.id
     WHERE t.team_id = $1 AND t.deadline < NOW()
       AND t.status != 'done' AND t.is_deleted = false
     ORDER BY t.deadline ASC`,
    [teamId]
  );
  return result.rows;
}

module.exports = {
  createTask,
  getTasks,
  getTaskById,
  updateTask,
  deleteTask,
  getTaskStats,
  getOverdueTasks
};
