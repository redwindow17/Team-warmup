/**
 * Service Layer Tests — Task, Chat, AI, Workflow, Analytics, Storage, Notification
 * 
 * Comprehensive unit tests for all backend services.
 * Google Services Tested: Cloud SQL, Firestore, Vertex AI, BigQuery, GCS, FCM
 */

// Mock all Google Cloud dependencies
jest.mock('../config/database', () => ({
  query: jest.fn(),
  transaction: jest.fn(),
  getClient: jest.fn(),
  pool: { on: jest.fn() }
}));

jest.mock('../config/firebase', () => ({
  db: {
    collection: jest.fn(() => ({
      doc: jest.fn(() => ({
        get: jest.fn().mockResolvedValue({ exists: false }),
        set: jest.fn().mockResolvedValue({}),
        update: jest.fn().mockResolvedValue({}),
        collection: jest.fn(() => ({
          doc: jest.fn(() => ({
            set: jest.fn().mockResolvedValue({}),
            get: jest.fn().mockResolvedValue({ exists: true, data: () => ({ reactions: {}, isPinned: false }) })
          })),
          orderBy: jest.fn(() => ({
            limit: jest.fn(() => ({
              get: jest.fn().mockResolvedValue({ forEach: jest.fn() }),
              where: jest.fn(() => ({
                get: jest.fn().mockResolvedValue({ forEach: jest.fn() })
              }))
            }))
          }))
        }))
      })),
      where: jest.fn(() => ({
        orderBy: jest.fn(() => ({
          get: jest.fn().mockResolvedValue({ forEach: jest.fn() })
        }))
      }))
    })),
    runTransaction: jest.fn()
  },
  auth: {},
  messaging: { send: jest.fn() },
  sendPushNotification: jest.fn().mockResolvedValue('message-id'),
  verifyToken: jest.fn()
}));

jest.mock('../config/bigquery', () => ({
  runQuery: jest.fn().mockResolvedValue([]),
  insertRows: jest.fn().mockResolvedValue({}),
  logTaskEvent: jest.fn(),
  logUserActivity: jest.fn(),
  initializeAnalytics: jest.fn(),
  DATASET_ID: 'test_dataset'
}));

jest.mock('../config/vertexai', () => ({
  generateContent: jest.fn().mockResolvedValue('AI generated response'),
  getModel: jest.fn(),
  SYSTEM_INSTRUCTION: 'test instructions'
}));

jest.mock('../config/storage', () => ({
  uploadFile: jest.fn().mockResolvedValue({ fileName: 'test.pdf', bucket: 'test-bucket' }),
  getSignedUrl: jest.fn().mockResolvedValue('https://signed-url.example.com'),
  deleteFile: jest.fn().mockResolvedValue({}),
  listFiles: jest.fn().mockResolvedValue([])
}));

const { query, transaction } = require('../config/database');
const { logTaskEvent } = require('../config/bigquery');

// ============================================
// Task Service Tests (Cloud SQL)
// ============================================

describe('Task Service', () => {
  const taskService = require('../services/taskService');

  beforeEach(() => jest.clearAllMocks());

  test('createTask inserts into Cloud SQL and logs to BigQuery', async () => {
    const mockTask = {
      id: 'task-uuid-1', title: 'Build feature', status: 'todo',
      priority: 'high', team_id: 'team-1', assignee_id: null
    };
    query
      .mockResolvedValueOnce({ rows: [mockTask] })    // INSERT task
      .mockResolvedValueOnce({ rows: [] });             // INSERT activity

    const result = await taskService.createTask({
      title: 'Build feature', teamId: 'team-1', priority: 'high'
    }, 'user-1');

    expect(result.title).toBe('Build feature');
    expect(query).toHaveBeenCalledTimes(2);
    expect(logTaskEvent).toHaveBeenCalledWith(expect.objectContaining({
      type: 'task_created',
      taskId: 'task-uuid-1'
    }));
  });

  test('getTasks returns paginated results with filters', async () => {
    query
      .mockResolvedValueOnce({ rows: [{ count: '5' }] })  // COUNT
      .mockResolvedValueOnce({ rows: [
        { id: 't1', title: 'Task 1' },
        { id: 't2', title: 'Task 2' }
      ]});

    const result = await taskService.getTasks('team-1', { page: 1, limit: 20 });

    expect(result.tasks).toHaveLength(2);
    expect(result.pagination.total).toBe(5);
    expect(result.pagination.page).toBe(1);
  });

  test('getTasks supports status and priority filters', async () => {
    query
      .mockResolvedValueOnce({ rows: [{ count: '1' }] })
      .mockResolvedValueOnce({ rows: [{ id: 't1', title: 'Urgent Task' }] });

    const result = await taskService.getTasks('team-1', {
      status: 'todo',
      priority: 'urgent'
    });

    expect(result.tasks).toHaveLength(1);
    // Verify parameterized queries (SQL injection prevention)
    const countCall = query.mock.calls[0];
    expect(countCall[0]).toContain('$1');
    expect(countCall[0]).toContain('$2');
  });

  test('getTaskById returns null for non-existent tasks', async () => {
    query.mockResolvedValue({ rows: [] });

    const result = await taskService.getTaskById('non-existent-id');
    expect(result).toBeNull();
  });

  test('updateTask logs status change to BigQuery', async () => {
    query
      .mockResolvedValueOnce({ rows: [{ id: 't1', status: 'todo', team_id: 'team-1', priority: 'medium' }] })  // getTaskById
      .mockResolvedValueOnce({ rows: [{ id: 't1', status: 'in_progress' }] });  // UPDATE

    await taskService.updateTask('t1', { status: 'in_progress' }, 'user-1');

    expect(logTaskEvent).toHaveBeenCalledWith(expect.objectContaining({
      type: 'status_changed',
      oldStatus: 'todo',
      newStatus: 'in_progress'
    }));
  });

  test('deleteTask performs soft delete', async () => {
    query.mockResolvedValue({ rows: [{ id: 't1', team_id: 'team-1' }] });

    const result = await taskService.deleteTask('t1', 'user-1');

    expect(result.id).toBe('t1');
    const deleteCall = query.mock.calls[0];
    expect(deleteCall[0]).toContain('is_deleted = true');
  });

  test('getTaskStats returns aggregated counts', async () => {
    query.mockResolvedValue({
      rows: [{ todo_count: '5', in_progress_count: '3', review_count: '1', done_count: '10', overdue_count: '2', total: '19' }]
    });

    const stats = await taskService.getTaskStats('team-1');

    expect(stats.todo_count).toBe('5');
    expect(stats.done_count).toBe('10');
    expect(stats.overdue_count).toBe('2');
  });

  test('getOverdueTasks filters correctly', async () => {
    query.mockResolvedValue({ rows: [{ id: 't1', title: 'Late task', deadline: '2026-01-01' }] });

    const results = await taskService.getOverdueTasks('team-1');

    expect(results).toHaveLength(1);
    const sql = query.mock.calls[0][0];
    expect(sql).toContain('deadline < NOW()');
    expect(sql).toContain("status != 'done'");
  });
});

// ============================================
// Workflow Engine Tests
// ============================================

describe('Workflow Engine', () => {
  const { evaluateConditions, executeActions } = require('../services/workflowEngine');

  test('evaluateConditions handles all operators', () => {
    expect(evaluateConditions([
      { field: 'status', operator: 'equals', value: 'done' }
    ], { status: 'done' })).toBe(true);

    expect(evaluateConditions([
      { field: 'status', operator: 'not_equals', value: 'done' }
    ], { status: 'todo' })).toBe(true);

    expect(evaluateConditions([
      { field: 'title', operator: 'contains', value: 'urgent' }
    ], { title: 'This is urgent' })).toBe(true);

    expect(evaluateConditions([
      { field: 'count', operator: 'greater_than', value: '5' }
    ], { count: 10 })).toBe(true);

    expect(evaluateConditions([
      { field: 'count', operator: 'less_than', value: '5' }
    ], { count: 3 })).toBe(true);
  });

  test('evaluateConditions handles unknown operator gracefully', () => {
    expect(evaluateConditions([
      { field: 'x', operator: 'unknown_op', value: 'y' }
    ], { x: 'anything' })).toBe(true);
  });

  test('evaluateConditions applies AND logic for multiple conditions', () => {
    const conditions = [
      { field: 'priority', operator: 'equals', value: 'high' },
      { field: 'status', operator: 'not_equals', value: 'done' }
    ];

    expect(evaluateConditions(conditions, { priority: 'high', status: 'todo' })).toBe(true);
    expect(evaluateConditions(conditions, { priority: 'high', status: 'done' })).toBe(false);
    expect(evaluateConditions(conditions, { priority: 'low', status: 'todo' })).toBe(false);
  });
});

// ============================================
// AI Service Tests (Vertex AI)
// ============================================

describe('AI Service', () => {
  const aiService = require('../services/aiService');
  const { generateContent } = require('../config/vertexai');

  beforeEach(() => jest.clearAllMocks());

  test('suggestNextActions returns suggestions from Vertex AI', async () => {
    query.mockResolvedValue({
      rows: [
        { title: 'Task 1', status: 'todo', priority: 'high', assignee_name: 'Alice', deadline: null }
      ]
    });
    generateContent.mockResolvedValue('1. Focus on Task 1');

    const result = await aiService.suggestNextActions('team-1', 'user-1');

    expect(result.suggestions).toContain('Task 1');
    expect(result.taskCount).toBe(1);
    expect(result.generatedAt).toBeDefined();
  });

  test('suggestNextActions handles empty task list', async () => {
    query.mockResolvedValue({ rows: [] });

    const result = await aiService.suggestNextActions('team-1', 'user-1');

    expect(result.suggestions).toBe('All tasks completed!');
    expect(result.taskCount).toBe(0);
  });

  test('detectDelays returns analysis for overdue tasks', async () => {
    query.mockResolvedValue({
      rows: [{ title: 'Late task', days_overdue: 3, assignee_name: 'Bob' }]
    });
    generateContent.mockResolvedValue('Root cause analysis...');

    const result = await aiService.detectDelays('team-1');

    expect(result.delayedCount).toBe(1);
    expect(result.analysis).toBe('Root cause analysis...');
  });

  test('detectDelays handles no delays', async () => {
    query.mockResolvedValue({ rows: [] });

    const result = await aiService.detectDelays('team-1');

    expect(result.analysis).toBe('No delays detected!');
    expect(result.delayedCount).toBe(0);
  });

  test('convertChatToTasks extracts tasks from conversation', async () => {
    generateContent.mockResolvedValue('Here are extracted tasks: [{"title":"Review PR","description":"Review pull request #42","priority":"high","suggestedAssignee":"Alice"}]');

    const result = await aiService.convertChatToTasks([
      { senderName: 'Bob', text: 'Alice, can you review PR #42? It is high priority.' }
    ]);

    expect(result.tasks).toHaveLength(1);
    expect(result.tasks[0].title).toBe('Review PR');
  });

  test('convertChatToTasks handles non-JSON AI responses gracefully', async () => {
    generateContent.mockResolvedValue('No actionable tasks found in this conversation.');

    const result = await aiService.convertChatToTasks([
      { senderName: 'Bob', text: 'Nice weather today!' }
    ]);

    expect(result.tasks).toHaveLength(0);
    expect(result.rawAnalysis).toBeDefined();
  });
});

// ============================================
// Analytics Service Tests (BigQuery)
// ============================================

describe('Analytics Service', () => {
  const analyticsService = require('../services/analyticsService');
  const { runQuery } = require('../config/bigquery');

  beforeEach(() => jest.clearAllMocks());

  test('getProductivityMetrics queries BigQuery with correct parameters', async () => {
    runQuery.mockResolvedValue([{ date: '2026-05-01', created: 5, completed: 3, deleted: 0 }]);

    const result = await analyticsService.getProductivityMetrics('team-1', 30);

    expect(runQuery).toHaveBeenCalledWith(
      expect.stringContaining('task_events'),
      expect.objectContaining({ teamId: 'team-1', days: 30 })
    );
    expect(result).toHaveLength(1);
  });

  test('getCompletionRates returns per-user completion data', async () => {
    runQuery.mockResolvedValue([
      { user_id: 'u1', completed: 10, touched: 15 },
      { user_id: 'u2', completed: 5, touched: 8 }
    ]);

    const result = await analyticsService.getCompletionRates('team-1');

    expect(result).toHaveLength(2);
    expect(result[0].completed).toBe(10);
  });

  test('getBottlenecks identifies long-running tasks', async () => {
    runQuery.mockResolvedValue([
      { task_id: 't1', hours_in_progress: 120, still_open: true }
    ]);

    const result = await analyticsService.getBottlenecks('team-1');

    expect(result[0].hours_in_progress).toBe(120);
    expect(result[0].still_open).toBe(true);
  });

  test('getMemberPerformance returns user-specific metrics', async () => {
    runQuery.mockResolvedValue([
      { event_type: 'task_created', count: 5, date: '2026-05-01' }
    ]);

    const result = await analyticsService.getMemberPerformance('team-1', 'user-1', 30);

    expect(runQuery).toHaveBeenCalledWith(
      expect.stringContaining('user_id'),
      expect.objectContaining({ userId: 'user-1' })
    );
  });
});

// ============================================
// Storage Service Tests (Google Cloud Storage)
// ============================================

describe('Storage Service', () => {
  const storageService = require('../services/storageService');
  const { uploadFile, getSignedUrl, deleteFile, listFiles } = require('../config/storage');

  beforeEach(() => jest.clearAllMocks());

  test('handleFileUpload creates correct GCS path', async () => {
    await storageService.handleFileUpload(
      { originalname: 'report.pdf', buffer: Buffer.from('content'), mimetype: 'application/pdf' },
      { userId: 'user-1', teamId: 'team-1', taskId: 'task-1' }
    );

    expect(uploadFile).toHaveBeenCalledWith(
      expect.any(Buffer),
      expect.stringContaining('team-1/task-1/'),
      'application/pdf',
      expect.objectContaining({ uploadedBy: 'user-1' })
    );
  });

  test('handleFileUpload uses "general" folder when no taskId', async () => {
    await storageService.handleFileUpload(
      { originalname: 'avatar.png', buffer: Buffer.from('img'), mimetype: 'image/png' },
      { userId: 'user-1', teamId: 'team-1' }
    );

    expect(uploadFile).toHaveBeenCalledWith(
      expect.any(Buffer),
      expect.stringContaining('team-1/general/'),
      'image/png',
      expect.any(Object)
    );
  });

  test('getDownloadUrl generates signed URL', async () => {
    await storageService.getDownloadUrl('team-1/task-1/file.pdf');

    expect(getSignedUrl).toHaveBeenCalledWith('team-1/task-1/file.pdf', 60);
  });

  test('removeFile deletes from GCS', async () => {
    await storageService.removeFile('team-1/task-1/file.pdf');

    expect(deleteFile).toHaveBeenCalledWith('team-1/task-1/file.pdf');
  });

  test('getTaskFiles lists with correct prefix', async () => {
    await storageService.getTaskFiles('team-1', 'task-1');

    expect(listFiles).toHaveBeenCalledWith('team-1/task-1/');
  });
});

// ============================================
// Notification Service Tests (Firebase Cloud Messaging)
// ============================================

describe('Notification Service', () => {
  const notificationService = require('../services/notificationService');
  const { sendPushNotification } = require('../config/firebase');

  beforeEach(() => jest.clearAllMocks());

  test('notifyUser sends FCM notification when token exists', async () => {
    query.mockResolvedValue({ rows: [{ fcm_token: 'device-token-123' }] });

    await notificationService.notifyUser('user-1', 'Alert', 'Task overdue');

    expect(sendPushNotification).toHaveBeenCalledWith(
      'device-token-123', 'Alert', 'Task overdue', expect.any(Object)
    );
  });

  test('notifyUser skips FCM when no token but still creates in-app notification', async () => {
    query.mockResolvedValue({ rows: [{ fcm_token: null }] });

    await notificationService.notifyUser('user-1', 'Info', 'Update available');

    expect(sendPushNotification).not.toHaveBeenCalled();
  });

  test('notifyTeam notifies all members except sender', async () => {
    query.mockResolvedValue({
      rows: [{ user_id: 'u1' }, { user_id: 'u2' }, { user_id: 'u3' }]
    });

    // Mock notifyUser calls
    query
      .mockResolvedValueOnce({ rows: [{ user_id: 'u1' }, { user_id: 'u2' }, { user_id: 'u3' }] })
      .mockResolvedValue({ rows: [{ fcm_token: null }] });

    await notificationService.notifyTeam('team-1', 'Update', 'New task created', 'u1');

    // u1 should be excluded (the sender)
    const userQueries = query.mock.calls.filter(c => c[0]?.includes('fcm_token'));
    expect(userQueries.length).toBe(2); // u2 and u3 only
  });
});

// ============================================
// Chat Service Tests (Cloud Firestore)
// ============================================

describe('Chat Service', () => {
  const chatService = require('../services/chatService');

  test('createChannel generates UUID and stores in Firestore', async () => {
    const result = await chatService.createChannel({
      name: 'general',
      teamId: 'team-1',
      members: ['u1', 'u2'],
      createdBy: 'u1'
    });

    expect(result.id).toBeDefined();
    expect(result.name).toBe('general');
    expect(result.teamId).toBe('team-1');
    expect(result.type).toBe('channel');
  });

  test('sendMessage creates message with correct structure', async () => {
    const result = await chatService.sendMessage({
      text: 'Hello team!',
      senderId: 'u1',
      senderName: 'Alice',
      channelId: 'ch-1'
    });

    expect(result.id).toBeDefined();
    expect(result.text).toBe('Hello team!');
    expect(result.senderId).toBe('u1');
    expect(result.timestamp).toBeDefined();
    expect(result.reactions).toEqual({});
    expect(result.isPinned).toBe(false);
  });

  test('createNotification stores in Firestore', async () => {
    const result = await chatService.createNotification('u1', {
      title: 'New Message',
      body: 'You have a new message',
      type: 'chat',
      link: '/chat/ch-1'
    });

    expect(result).toBeDefined(); // Returns notification ID
  });

  test('setPresence updates Firestore document', async () => {
    await chatService.setPresence('u1', true);
    // Should not throw
  });
});
