/**
 * Input Validation Middleware
 * 
 * Uses express-validator for request validation.
 * Reusable validation chains for common patterns.
 */

const { body, param, query, validationResult } = require('express-validator');

/**
 * Process validation results and return errors if any
 */
function handleValidation(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array().map(err => ({
        field: err.path,
        message: err.msg,
        value: err.value
      }))
    });
  }
  next();
}

// Common validation chains
const validateTask = [
  body('title')
    .trim()
    .notEmpty().withMessage('Title is required')
    .isLength({ max: 500 }).withMessage('Title must be under 500 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 5000 }).withMessage('Description must be under 5000 characters'),
  body('status')
    .optional()
    .isIn(['todo', 'in_progress', 'review', 'done']).withMessage('Invalid status'),
  body('priority')
    .optional()
    .isIn(['low', 'medium', 'high', 'urgent']).withMessage('Invalid priority'),
  body('deadline')
    .optional()
    .isISO8601().withMessage('Deadline must be a valid date'),
  body('teamId')
    .notEmpty().withMessage('Team ID is required')
    .isUUID().withMessage('Invalid team ID'),
  handleValidation
];

const validateMessage = [
  body('text')
    .trim()
    .notEmpty().withMessage('Message text is required')
    .isLength({ max: 10000 }).withMessage('Message must be under 10000 characters'),
  body('channelId')
    .notEmpty().withMessage('Channel ID is required'),
  handleValidation
];

const validateWorkflow = [
  body('name')
    .trim()
    .notEmpty().withMessage('Workflow name is required')
    .isLength({ max: 255 }).withMessage('Name must be under 255 characters'),
  body('triggerType')
    .notEmpty().withMessage('Trigger type is required')
    .isIn([
      'task_created', 'task_delayed', 'status_changed',
      'deadline_approaching', 'task_assigned', 'task_completed'
    ]).withMessage('Invalid trigger type'),
  body('teamId')
    .notEmpty().withMessage('Team ID is required')
    .isUUID().withMessage('Invalid team ID'),
  handleValidation
];

const validateUUID = [
  param('id').isUUID().withMessage('Invalid ID format'),
  handleValidation
];

module.exports = {
  handleValidation,
  validateTask,
  validateMessage,
  validateWorkflow,
  validateUUID
};
