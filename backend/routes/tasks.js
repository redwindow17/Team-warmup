/**
 * Task Routes — Cloud SQL CRUD + Vertex AI Suggestions
 */

const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { requireTeamMember } = require('../middleware/roleCheck');
const { validateTask, validateUUID } = require('../middleware/validate');
const taskService = require('../services/taskService');
const { triggerWorkflows } = require('../services/workflowEngine');
const { logUserActivity } = require('../config/bigquery');

// All routes require authentication
router.use(authenticate);

// Create task
router.post('/', validateTask, async (req, res) => {
  try {
    const task = await taskService.createTask(req.body, req.user.id);
    // Trigger workflows
    await triggerWorkflows(task.team_id, 'task_created', {
      taskId: task.id, title: task.title, assigneeId: task.assignee_id,
      priority: task.priority, description: `New task: ${task.title}`
    });
    // Emit real-time update
    req.app.get('io').to(`team:${task.team_id}`).emit('task-created', task);
    logUserActivity({ userId: req.user.id, teamId: task.team_id, actionType: 'task_created', details: { taskId: task.id } });
    res.status(201).json(task);
  } catch (err) {
    console.error('[Tasks] Create error:', err);
    res.status(500).json({ error: 'Failed to create task' });
  }
});

// List tasks for a team
router.get('/team/:teamId', async (req, res) => {
  try {
    const result = await taskService.getTasks(req.params.teamId, {
      status: req.query.status,
      priority: req.query.priority,
      assigneeId: req.query.assigneeId,
      search: req.query.search,
      sortBy: req.query.sortBy,
      page: req.query.page,
      limit: req.query.limit
    });
    res.json(result);
  } catch (err) {
    console.error('[Tasks] List error:', err);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

// Get task by ID
router.get('/:id', validateUUID, async (req, res) => {
  try {
    const task = await taskService.getTaskById(req.params.id);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    res.json(task);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch task' });
  }
});

// Update task
router.put('/:id', validateUUID, async (req, res) => {
  try {
    const oldTask = await taskService.getTaskById(req.params.id);
    const task = await taskService.updateTask(req.params.id, req.body, req.user.id);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    // Trigger workflows on status change
    if (req.body.status && req.body.status !== oldTask.status) {
      await triggerWorkflows(task.team_id, 'status_changed', {
        taskId: task.id, title: task.title, assigneeId: task.assignee_id,
        oldStatus: oldTask.status, newStatus: req.body.status,
        description: `Task "${task.title}" moved to ${req.body.status}`
      });
      if (req.body.status === 'done') {
        await triggerWorkflows(task.team_id, 'task_completed', {
          taskId: task.id, title: task.title, assigneeId: task.assignee_id
        });
      }
    }
    req.app.get('io').to(`team:${task.team_id}`).emit('task-updated', task);
    res.json(task);
  } catch (err) {
    console.error('[Tasks] Update error:', err);
    res.status(500).json({ error: 'Failed to update task' });
  }
});

// Delete task (soft)
router.delete('/:id', validateUUID, async (req, res) => {
  try {
    const task = await taskService.deleteTask(req.params.id, req.user.id);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    req.app.get('io').to(`team:${task.team_id}`).emit('task-deleted', { id: task.id });
    res.json({ message: 'Task deleted', id: task.id });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete task' });
  }
});

// Get task stats for a team
router.get('/stats/:teamId', async (req, res) => {
  try {
    const stats = await taskService.getTaskStats(req.params.teamId);
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

module.exports = router;
