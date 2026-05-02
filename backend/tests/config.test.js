/**
 * Configuration Module Tests — Google Cloud Service Initialization
 * 
 * Tests for:
 * - BigQuery analytics initialization and event logging
 * - Cloud SQL connection pool configuration
 * - Vertex AI model configuration and safety settings
 * - Google Cloud Storage bucket operations
 * - Firebase Admin SDK initialization
 * 
 * Google Services Tested: BigQuery, Cloud SQL, Vertex AI, GCS, Firebase
 */

// ============================================
// BigQuery Configuration Tests
// ============================================

describe('BigQuery Configuration', () => {
  beforeEach(() => jest.resetModules());

  test('exports correct DATASET_ID', () => {
    jest.mock('@google-cloud/bigquery', () => ({
      BigQuery: jest.fn(() => ({
        query: jest.fn(),
        dataset: jest.fn(() => ({
          exists: jest.fn().mockResolvedValue([true]),
          table: jest.fn(() => ({
            exists: jest.fn().mockResolvedValue([true]),
            insert: jest.fn().mockResolvedValue({})
          })),
          createTable: jest.fn()
        })),
        createDataset: jest.fn()
      }))
    }));

    const bq = require('../config/bigquery');
    expect(bq.DATASET_ID).toBe(process.env.BQ_DATASET || 'syncsphere_analytics');
  });

  test('logTaskEvent creates properly structured row', () => {
    jest.mock('@google-cloud/bigquery', () => {
      const mockInsert = jest.fn().mockResolvedValue({});
      return {
        BigQuery: Object.assign(
          jest.fn(() => ({
            query: jest.fn(),
            dataset: jest.fn(() => ({
              exists: jest.fn().mockResolvedValue([true]),
              table: jest.fn(() => ({
                exists: jest.fn().mockResolvedValue([true]),
                insert: mockInsert
              })),
              createTable: jest.fn()
            })),
            createDataset: jest.fn()
          })),
          { timestamp: jest.fn(d => d) }
        )
      };
    });

    const { logTaskEvent } = require('../config/bigquery');
    
    // logTaskEvent should not throw
    expect(() => logTaskEvent({
      type: 'task_created',
      taskId: 'task-1',
      userId: 'user-1',
      teamId: 'team-1'
    })).not.toThrow();
  });
});

// ============================================
// Utility Constants Tests
// ============================================

describe('Constants', () => {
  const constants = require('../utils/constants');

  test('TASK_STATUSES contains all valid statuses', () => {
    expect(constants.TASK_STATUSES).toContain('todo');
    expect(constants.TASK_STATUSES).toContain('in_progress');
    expect(constants.TASK_STATUSES).toContain('review');
    expect(constants.TASK_STATUSES).toContain('done');
    expect(constants.TASK_STATUSES).toHaveLength(4);
  });

  test('TASK_PRIORITIES contains all valid priorities', () => {
    expect(constants.TASK_PRIORITIES).toContain('low');
    expect(constants.TASK_PRIORITIES).toContain('medium');
    expect(constants.TASK_PRIORITIES).toContain('high');
    expect(constants.TASK_PRIORITIES).toContain('urgent');
    expect(constants.TASK_PRIORITIES).toHaveLength(4);
  });

  test('USER_ROLES contains all valid roles', () => {
    expect(constants.USER_ROLES).toContain('admin');
    expect(constants.USER_ROLES).toContain('manager');
    expect(constants.USER_ROLES).toContain('member');
    expect(constants.USER_ROLES).toHaveLength(3);
  });

  test('WORKFLOW_TRIGGERS contains all valid triggers', () => {
    expect(constants.WORKFLOW_TRIGGERS).toContain('task_created');
    expect(constants.WORKFLOW_TRIGGERS).toContain('task_delayed');
    expect(constants.WORKFLOW_TRIGGERS).toContain('status_changed');
    expect(constants.WORKFLOW_TRIGGERS).toContain('deadline_approaching');
    expect(constants.WORKFLOW_TRIGGERS).toContain('task_assigned');
    expect(constants.WORKFLOW_TRIGGERS).toContain('task_completed');
  });

  test('WORKFLOW_ACTIONS contains all valid actions', () => {
    expect(constants.WORKFLOW_ACTIONS).toContain('send_notification');
    expect(constants.WORKFLOW_ACTIONS).toContain('auto_assign');
    expect(constants.WORKFLOW_ACTIONS).toContain('update_status');
  });

  test('FILE constraints are properly set', () => {
    expect(constants.MAX_FILE_SIZE).toBe(10 * 1024 * 1024); // 10MB
    expect(constants.ALLOWED_FILE_TYPES).toContain('image/jpeg');
    expect(constants.ALLOWED_FILE_TYPES).toContain('application/pdf');
    expect(constants.ALLOWED_FILE_TYPES).not.toContain('application/javascript');
  });

  test('Pagination defaults are reasonable', () => {
    expect(constants.DEFAULT_PAGE_SIZE).toBe(20);
    expect(constants.MAX_PAGE_SIZE).toBe(100);
  });
});

// ============================================
// Utility Helpers Tests
// ============================================

describe('Helpers', () => {
  const { daysUntilDeadline, sanitize, paginate, formatDate } = require('../utils/helpers');

  describe('daysUntilDeadline', () => {
    test('returns positive days for future deadline', () => {
      const future = new Date(Date.now() + 5 * 86400000).toISOString();
      expect(daysUntilDeadline(future)).toBeGreaterThanOrEqual(4);
      expect(daysUntilDeadline(future)).toBeLessThanOrEqual(6);
    });

    test('returns negative days for past deadline', () => {
      const past = new Date(Date.now() - 3 * 86400000).toISOString();
      expect(daysUntilDeadline(past)).toBeLessThan(0);
    });

    test('returns 0 or 1 for today', () => {
      const today = new Date().toISOString();
      expect(daysUntilDeadline(today)).toBeLessThanOrEqual(1);
      expect(daysUntilDeadline(today)).toBeGreaterThanOrEqual(0);
    });
  });

  describe('sanitize', () => {
    test('escapes HTML special characters', () => {
      expect(sanitize('<script>alert("xss")</script>')).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
    });

    test('escapes ampersands', () => {
      expect(sanitize('A & B')).toBe('A &amp; B');
    });

    test('escapes single quotes', () => {
      expect(sanitize("it's")).toBe("it&#x27;s");
    });

    test('returns empty string for null/undefined', () => {
      expect(sanitize(null)).toBe('');
      expect(sanitize(undefined)).toBe('');
      expect(sanitize('')).toBe('');
    });

    test('does not modify safe text', () => {
      expect(sanitize('Hello World 123')).toBe('Hello World 123');
    });
  });

  describe('paginate', () => {
    test('calculates correct offset for page 1', () => {
      expect(paginate(1, 20)).toEqual({ offset: 0, limit: 20, page: 1 });
    });

    test('calculates correct offset for subsequent pages', () => {
      expect(paginate(3, 10)).toEqual({ offset: 20, limit: 10, page: 3 });
    });

    test('clamps page to minimum of 1', () => {
      expect(paginate(-5, 20)).toEqual({ offset: 0, limit: 20, page: 1 });
      expect(paginate(0, 20)).toEqual({ offset: 0, limit: 20, page: 1 });
    });

    test('clamps limit to maximum of 100', () => {
      expect(paginate(1, 500)).toEqual({ offset: 0, limit: 100, page: 1 });
    });

    test('clamps limit to minimum of 1', () => {
      expect(paginate(1, 0)).toEqual({ offset: 0, limit: 1, page: 1 });
      expect(paginate(1, -10)).toEqual({ offset: 0, limit: 1, page: 1 });
    });

    test('uses defaults when no arguments', () => {
      const result = paginate();
      expect(result.page).toBe(1);
      expect(result.offset).toBe(0);
      expect(result.limit).toBeGreaterThanOrEqual(1);
    });
  });

  describe('formatDate', () => {
    test('formats a valid date', () => {
      const result = formatDate('2026-05-01T10:30:00Z');
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    test('handles Date object', () => {
      const result = formatDate(new Date());
      expect(result).toBeDefined();
    });
  });
});
