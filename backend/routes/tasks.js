/**
 * @fileoverview Task Routes — Cloud SQL CRUD + Vertex AI Suggestions
 * @module routes/tasks
 * @requires express
 * @requires ../middleware/auth
 * @requires ../middleware/roleCheck
 * @requires ../middleware/validate
 * @requires ../services/taskService
 * @requires ../services/workflowEngine
 * @requires ../config/bigquery
 * 
 * @description
 * RESTful API endpoints for task management operations.
 * All routes require Firebase Authentication.
 * 
 * @googleServices
 * - Cloud SQL (PostgreSQL): Task CRUD operations
 * - BigQuery: Activity logging and analytics
 * - Socket.io: Real-time task updates
 * 
 * @security
 * - Firebase Auth token required for all endpoints
 * - Team membership validation via middleware
 * - Input validation via express-validator
 * - Parameterized SQL queries prevent injection
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

/**
 * @route POST /api/tasks
 * @desc Create a new task
 * @access Private (requires authentication)
 * @param {Object} req.body - Task data (validated by validateTask middleware)
 * @param {string} req.body.title - Task title (required)
 * @param {string} req.body.teamId - Team ID (required, UUID)
 * @param {string} [req.body.description] - Task description
 * @param {string} [req.body.status='todo'] - Task status
 * @param {string} [req.body.priority='medium'] - Task priority
 * @param {string} [req.body.assigneeId] - Assignee user ID (UUID)
 * @param {string} [req.body.deadline] - Deadline (ISO 8601 date)
 * @param {string[]} [req.body.tags] - Task tags
 * @returns {Object} 201 - Created task object
 * @returns {Object} 400 - Validation error
 * @returns {Object} 500 - Server error
 */
router.post('/', validateTask, async (req, res) => {
  try {
    const task = await taskService.createTask(req.body, req.user.id);
    
    // Trigger workflow automation rules
    await triggerWorkflows(task.team_id, 'task_created', {
      taskId: task.id, 
      title: task.title, 
      assigneeId: task.assignee_id,
      priority: task.priority, 
      description: `New task: ${task.title}`
    });
    
    // Emit real-time update to team members
    const io = req.app.get('io');
    if (io) {
      io.to(`team:${task.team_id}`).emit('task-created', task);
    }
    
    // Log activity to BigQuery for analytics
    logUserActivity({ 
      userId: req.user.id, 
      teamId: task.team_id, 
      actionType: 'task_created', 
      details: { taskId: task.id } 
    });
    
    res.status(201).json(task);
  } catch (err) {
    console.error('[Tasks] Create error:', err);
    res.status(500).json({ 
      error: 'Failed to create task',
      message: err.message || 'An unexpected error occurred while creating the task'
    });
  }
});

/**
 * @route GET /api/tasks/team/:teamId
 * @desc List tasks for a team with filtering, sorting, and pagination
 * @access Private (requires authentication)
 * @param {string} req.params.teamId - Team ID (UUID)
 * @param {string} [req.query.status] - Filter by status (todo|in_progress|review|done)
 * @param {string} [req.query.priority] - Filter by priority (urgent|high|medium|low)
 * @param {string} [req.query.assigneeId] - Filter by assignee ID (UUID)
 * @param {string} [req.query.search] - Search in title and description
 * @param {string} [req.query.sortBy] - Sort by field (deadline|priority|created_at)
 * @param {number} [req.query.page=1] - Page number
 * @param {number} [req.query.limit=20] - Items per page (max 100)
 * @returns {Object} 200 - Paginated task list with metadata
 * @returns {Object} 500 - Server error
 */
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
    res.status(500).json({ 
      error: 'Failed to fetch tasks',
      message: err.message || 'An unexpected error occurred while fetching tasks'
    });
  }
});

/**
 * @route GET /api/tasks/:id
 * @desc Get a single task by ID
 * @access Private (requires authentication)
 * @param {string} req.params.id - Task ID (UUID, validated by validateUUID middleware)
 * @returns {Object} 200 - Task object with assignee and creator details
 * @returns {Object} 404 - Task not found
 * @returns {Object} 500 - Server error
 */
router.get('/:id', validateUUID, async (req, res) => {
  try {
    const task = await taskService.getTaskById(req.params.id);
    if (!task) {
      return res.status(404).json({ 
        error: 'Task not found',
        message: `No task found with ID: ${req.params.id}`
      });
    }
    res.json(task);
  } catch (err) {
    console.error('[Tasks] Get by ID error:', err);
    res.status(500).json({ 
      error: 'Failed to fetch task',
      message: err.message || 'An unexpected error occurred while fetching the task'
    });
  }
});

/**
 * @route PUT /api/tasks/:id
 * @desc Update a task
 * @access Private (requires authentication)
 * @param {string} req.params.id - Task ID (UUID, validated by validateUUID middleware)
 * @param {Object} req.body - Fields to update
 * @param {string} [req.body.title] - New title
 * @param {string} [req.body.description] - New description
 * @param {string} [req.body.status] - New status (triggers workflow on change)
 * @param {string} [req.body.priority] - New priority
 * @param {string} [req.body.assigneeId] - New assignee ID
 * @param {string} [req.body.deadline] - New deadline
 * @param {string[]} [req.body.tags] - New tags
 * @returns {Object} 200 - Updated task object
 * @returns {Object} 404 - Task not found
 * @returns {Object} 500 - Server error
 */
router.put('/:id', validateUUID, async (req, res) => {
  try {
    const oldTask = await taskService.getTaskById(req.params.id);
    if (!oldTask) {
      return res.status(404).json({ 
        error: 'Task not found',
        message: `No task found with ID: ${req.params.id}`
      });
    }
    
    const task = await taskService.updateTask(req.params.id, req.body, req.user.id);
    
    // Trigger workflows on status change
    if (req.body.status && req.body.status !== oldTask.status) {
      await triggerWorkflows(task.team_id, 'status_changed', {
        taskId: task.id, 
        title: task.title, 
        assigneeId: task.assignee_id,
        oldStatus: oldTask.status, 
        newStatus: req.body.status,
        description: `Task "${task.title}" moved to ${req.body.status}`
      });
      
      // Trigger task_completed workflow if status changed to done
      if (req.body.status === 'done') {
        await triggerWorkflows(task.team_id, 'task_completed', {
          taskId: task.id, 
          title: task.title, 
          assigneeId: task.assignee_id
        });
      }
    }
    
    // Emit real-time update
    const io = req.app.get('io');
    if (io) {
      io.to(`team:${task.team_id}`).emit('task-updated', task);
    }
    
    res.json(task);
  } catch (err) {
    console.error('[Tasks] Update error:', err);
    res.status(500).json({ 
      error: 'Failed to update task',
      message: err.message || 'An unexpected error occurred while updating the task'
    });
  }
});

/**
 * @route DELETE /api/tasks/:id
 * @desc Soft delete a task (sets is_deleted flag)
 * @access Private (requires authentication)
 * @param {string} req.params.id - Task ID (UUID, validated by validateUUID middleware)
 * @returns {Object} 200 - Deletion confirmation with task ID
 * @returns {Object} 404 - Task not found
 * @returns {Object} 500 - Server error
 */
router.delete('/:id', validateUUID, async (req, res) => {
  try {
    const task = await taskService.deleteTask(req.params.id, req.user.id);
    if (!task) {
      return res.status(404).json({ 
        error: 'Task not found',
        message: `No task found with ID: ${req.params.id}`
      });
    }
    
    // Emit real-time deletion event
    const io = req.app.get('io');
    if (io) {
      io.to(`team:${task.team_id}`).emit('task-deleted', { id: task.id });
    }
    
    res.json({ 
      message: 'Task deleted successfully', 
      id: task.id 
    });
  } catch (err) {
    console.error('[Tasks] Delete error:', err);
    res.status(500).json({ 
      error: 'Failed to delete task',
      message: err.message || 'An unexpected error occurred while deleting the task'
    });
  }
});

/**
 * @route GET /api/tasks/stats/:teamId
 * @desc Get task statistics for a team (counts by status, overdue count)
 * @access Private (requires authentication)
 * @param {string} req.params.teamId - Team ID (UUID)
 * @returns {Object} 200 - Statistics object with counts
 * @returns {Object} 500 - Server error
 */
router.get('/stats/:teamId', async (req, res) => {
  try {
    const stats = await taskService.getTaskStats(req.params.teamId);
    res.json(stats);
  } catch (err) {
    console.error('[Tasks] Stats error:', err);
    res.status(500).json({ 
      error: 'Failed to get task statistics',
      message: err.message || 'An unexpected error occurred while fetching task statistics'
    });
  }
});

module.exports = router;
