/**
 * Application Constants
 */

module.exports = {
  // Task statuses
  TASK_STATUSES: ['todo', 'in_progress', 'review', 'done'],

  // Task priorities
  TASK_PRIORITIES: ['low', 'medium', 'high', 'urgent'],

  // User roles
  USER_ROLES: ['admin', 'manager', 'member'],

  // Workflow triggers
  WORKFLOW_TRIGGERS: [
    'task_created',
    'task_delayed',
    'status_changed',
    'deadline_approaching',
    'task_assigned',
    'task_completed'
  ],

  // Workflow actions
  WORKFLOW_ACTIONS: [
    'send_notification',
    'auto_assign',
    'update_status',
    'send_reminder',
    'create_task'
  ],

  // Activity types
  ACTIVITY_TYPES: [
    'task_created',
    'task_updated',
    'task_completed',
    'task_assigned',
    'task_deleted',
    'message_sent',
    'channel_created',
    'member_joined',
    'member_left',
    'workflow_triggered',
    'file_uploaded'
  ],

  // Pagination defaults
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,

  // File upload limits
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  ALLOWED_FILE_TYPES: [
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain', 'text/csv'
  ]
};
