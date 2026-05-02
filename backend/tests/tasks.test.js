/**
 * Backend Unit Tests — Task Service & Workflow Engine
 */

const { evaluateConditions } = require('../services/workflowEngine');

describe('Workflow Engine', () => {
  describe('evaluateConditions', () => {
    test('returns true for empty conditions', () => {
      expect(evaluateConditions([], {})).toBe(true);
      expect(evaluateConditions(null, {})).toBe(true);
    });

    test('evaluates equals condition', () => {
      const conditions = [{ field: 'priority', operator: 'equals', value: 'high' }];
      expect(evaluateConditions(conditions, { priority: 'high' })).toBe(true);
      expect(evaluateConditions(conditions, { priority: 'low' })).toBe(false);
    });

    test('evaluates not_equals condition', () => {
      const conditions = [{ field: 'status', operator: 'not_equals', value: 'done' }];
      expect(evaluateConditions(conditions, { status: 'todo' })).toBe(true);
      expect(evaluateConditions(conditions, { status: 'done' })).toBe(false);
    });

    test('evaluates contains condition', () => {
      const conditions = [{ field: 'title', operator: 'contains', value: 'urgent' }];
      expect(evaluateConditions(conditions, { title: 'This is urgent task' })).toBe(true);
      expect(evaluateConditions(conditions, { title: 'Normal task' })).toBe(false);
    });

    test('evaluates multiple conditions (AND logic)', () => {
      const conditions = [
        { field: 'priority', operator: 'equals', value: 'high' },
        { field: 'status', operator: 'not_equals', value: 'done' }
      ];
      expect(evaluateConditions(conditions, { priority: 'high', status: 'todo' })).toBe(true);
      expect(evaluateConditions(conditions, { priority: 'high', status: 'done' })).toBe(false);
      expect(evaluateConditions(conditions, { priority: 'low', status: 'todo' })).toBe(false);
    });

    test('evaluates greater_than condition', () => {
      const conditions = [{ field: 'daysOverdue', operator: 'greater_than', value: '3' }];
      expect(evaluateConditions(conditions, { daysOverdue: 5 })).toBe(true);
      expect(evaluateConditions(conditions, { daysOverdue: 1 })).toBe(false);
    });
  });
});

describe('Task Validation', () => {
  const { TASK_STATUSES, TASK_PRIORITIES, USER_ROLES } = require('../utils/constants');

  test('valid task statuses', () => {
    expect(TASK_STATUSES).toEqual(['todo', 'in_progress', 'review', 'done']);
  });

  test('valid priorities', () => {
    expect(TASK_PRIORITIES).toEqual(['low', 'medium', 'high', 'urgent']);
  });

  test('valid user roles', () => {
    expect(USER_ROLES).toEqual(['admin', 'manager', 'member']);
  });
});

describe('Helpers', () => {
  const { daysUntilDeadline, sanitize, paginate } = require('../utils/helpers');

  test('daysUntilDeadline calculates correctly', () => {
    const future = new Date(Date.now() + 3 * 86400000).toISOString();
    const result = daysUntilDeadline(future);
    expect(result).toBeGreaterThanOrEqual(2);
    expect(result).toBeLessThanOrEqual(4);
  });

  test('sanitize removes XSS', () => {
    expect(sanitize('<script>alert("xss")</script>')).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
    expect(sanitize('')).toBe('');
    expect(sanitize(null)).toBe('');
  });

  test('paginate returns correct offset', () => {
    expect(paginate(1, 20)).toEqual({ offset: 0, limit: 20, page: 1 });
    expect(paginate(3, 10)).toEqual({ offset: 20, limit: 10, page: 3 });
    expect(paginate(-1, 200)).toEqual({ offset: 0, limit: 100, page: 1 });
  });
});
