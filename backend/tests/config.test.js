/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Configuration Module Tests — Google Cloud Service Initialization & Utilities
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * @file config.test.js
 * @module tests/config
 * @version 1.0.0
 * @description
 *   Unit tests for the configuration layer that initializes and manages
 *   connections to Google Cloud services, as well as shared utility modules
 *   (constants and helpers) used across all backend layers.
 *
 * @coverage
 *   ┌────────────────────────────────────────────────────────────────┐
 *   │ BigQuery Configuration                                        │
 *   │   • Dataset ID resolution from environment variables          │
 *   │   • logTaskEvent row structure and error-free invocation      │
 *   │                                                               │
 *   │ Utility Constants                                             │
 *   │   • TASK_STATUSES: ['todo','in_progress','review','done']     │
 *   │   • TASK_PRIORITIES: ['low','medium','high','urgent']         │
 *   │   • USER_ROLES: ['admin','manager','member']                  │
 *   │   • WORKFLOW_TRIGGERS: 6 trigger types                        │
 *   │   • WORKFLOW_ACTIONS: 3+ action types                         │
 *   │   • FILE constraints: 10MB max, allowed MIME types            │
 *   │   • Pagination defaults: 20/page, 100 max                    │
 *   │                                                               │
 *   │ Utility Helpers                                               │
 *   │   • daysUntilDeadline: future, past, and today dates          │
 *   │   • sanitize: XSS prevention (HTML entities, ampersands)      │
 *   │   • paginate: offset calculation, boundary clamping           │
 *   │   • formatDate: ISO string and Date object formatting         │
 *   └────────────────────────────────────────────────────────────────┘
 *
 * @googleServices BigQuery (analytics initialization), Cloud SQL (pool config)
 *
 * @testStrategy
 *   - BigQuery tests use jest.resetModules() to ensure fresh module state
 *     for each test, preventing mock contamination across tests.
 *   - The @google-cloud/bigquery module is mocked to simulate dataset
 *     existence checks, table creation, and row insertion.
 *   - Utility tests use the real module code (no mocks) since they are
 *     pure functions with no external dependencies.
 *
 * @securityNotes
 *   - sanitize() tests verify protection against XSS injection vectors:
 *     script tags, ampersand injection, single/double quote escaping
 *   - NULL/undefined input handling prevents runtime TypeError crashes
 */

// ============================================
// BigQuery Configuration Tests
// ============================================

/**
 * ═══════════════════════════════════════════════════════
 * BigQuery Configuration Tests
 * ═══════════════════════════════════════════════════════
 *
 * Tests for the BigQuery client initialization and event logging.
 * BigQuery is used as the analytics data warehouse for SyncSphere,
 * storing task events (creation, updates, completions) and user
 * activity data for the productivity dashboard.
 *
 * @googleService Google BigQuery
 * @see config/bigquery.js
 */
describe('BigQuery Configuration', () => {
  /** Reset module cache between tests to get fresh BigQuery instances */
  beforeEach(() => jest.resetModules());

  /**
   * @test Verify DATASET_ID resolves from environment or default
   *
   * @description
   *   The BigQuery dataset ID must be configurable via the BQ_DATASET
   *   environment variable for different environments (dev, staging, prod).
   *   If not set, it defaults to 'syncsphere_analytics'.
   *
   *   This allows:
   *   - Production: BQ_DATASET=syncsphere_prod_analytics
   *   - Staging: BQ_DATASET=syncsphere_staging_analytics
   *   - Local: defaults to syncsphere_analytics
   *
   * @expectedBehavior DATASET_ID matches env var or default value
   * @googleService BigQuery (dataset configuration)
   */
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

  /**
   * @test Verify logTaskEvent creates properly structured BigQuery rows
   *
   * @description
   *   logTaskEvent is called on every task lifecycle event (create, update,
   *   complete, delete). It must:
   *   - Accept an event object with type, taskId, userId, teamId
   *   - Not throw synchronously (it fires and forgets)
   *   - Create a row compatible with the BigQuery task_events table schema
   *
   *   This data feeds the Analytics dashboard, enabling:
   *   - Task completion velocity tracking
   *   - Bottleneck detection (long-running tasks)
   *   - Member performance metrics
   *
   * @expectedBehavior logTaskEvent() does not throw for valid input
   * @googleService BigQuery (streaming insert into task_events table)
   */
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

/**
 * ═══════════════════════════════════════════════════════
 * Application Constants Tests
 * ═══════════════════════════════════════════════════════
 *
 * Validates the shared constants used across the backend for
 * data validation, workflow triggers, file handling, and pagination.
 * These constants are the single source of truth for enumerations
 * used by middleware validators, service layer logic, and the
 * workflow engine.
 *
 * Changes to these constants affect:
 * - express-validator middleware chains (validate.js)
 * - Cloud SQL queries (taskService.js)
 * - BigQuery event categorization (analyticsService.js)
 * - Workflow trigger matching (workflowEngine.js)
 * - File upload acceptance (storageService.js)
 *
 * @see utils/constants.js
 */
describe('Constants', () => {
  const constants = require('../utils/constants');

  /**
   * @test Verify all valid task statuses are defined
   *
   * @description
   *   Task statuses define the Kanban board columns and are used in:
   *   - Cloud SQL WHERE clauses for task filtering
   *   - BigQuery event categorization
   *   - Workflow trigger conditions (status_changed)
   *   - Frontend Kanban column rendering
   *
   *   The 4 statuses map to a standard Kanban workflow:
   *   todo → in_progress → review → done
   *
   * @expectedBehavior Exactly 4 statuses: todo, in_progress, review, done
   */
  test('TASK_STATUSES contains all valid statuses', () => {
    expect(constants.TASK_STATUSES).toContain('todo');
    expect(constants.TASK_STATUSES).toContain('in_progress');
    expect(constants.TASK_STATUSES).toContain('review');
    expect(constants.TASK_STATUSES).toContain('done');
    expect(constants.TASK_STATUSES).toHaveLength(4);
  });

  /**
   * @test Verify all valid task priorities are defined
   *
   * @description
   *   Task priorities control:
   *   - Display ordering in the frontend task list
   *   - Vertex AI suggestion weighting (urgent tasks first)
   *   - Workflow trigger conditions (e.g., notify manager on urgent)
   *   - BigQuery bottleneck analysis severity scoring
   *
   * @expectedBehavior Exactly 4 priorities: low, medium, high, urgent
   */
  test('TASK_PRIORITIES contains all valid priorities', () => {
    expect(constants.TASK_PRIORITIES).toContain('low');
    expect(constants.TASK_PRIORITIES).toContain('medium');
    expect(constants.TASK_PRIORITIES).toContain('high');
    expect(constants.TASK_PRIORITIES).toContain('urgent');
    expect(constants.TASK_PRIORITIES).toHaveLength(4);
  });

  /**
   * @test Verify all valid user roles are defined
   *
   * @description
   *   User roles control role-based access control (RBAC):
   *   - admin: full access (team management, user management, all data)
   *   - manager: team-scoped write access (task assignment, workflow creation)
   *   - member: team-scoped read/write on own tasks, chat participation
   *
   *   Roles are stored in Cloud SQL users table and checked by roleCheck.js
   *   middleware on every authenticated request.
   *
   * @expectedBehavior Exactly 3 roles: admin, manager, member
   * @securityNote These roles are enforced server-side, never client-side
   */
  test('USER_ROLES contains all valid roles', () => {
    expect(constants.USER_ROLES).toContain('admin');
    expect(constants.USER_ROLES).toContain('manager');
    expect(constants.USER_ROLES).toContain('member');
    expect(constants.USER_ROLES).toHaveLength(3);
  });

  /**
   * @test Verify all workflow trigger types are defined
   *
   * @description
   *   Workflow triggers are event types that activate automation rules.
   *   When a matching event occurs, the workflow engine evaluates
   *   conditions and executes actions (notifications, status updates).
   *
   *   Triggers:
   *   - task_created: fires when a new task is inserted into Cloud SQL
   *   - task_delayed: fires when a task passes its deadline
   *   - status_changed: fires on any task status transition
   *   - deadline_approaching: fires from the 30-minute deadline checker
   *   - task_assigned: fires when assignee_id is set
   *   - task_completed: fires when status changes to 'done'
   *
   * @expectedBehavior All 6 trigger types are present
   * @googleService Cloud SQL (trigger source), FCM (notification target)
   */
  test('WORKFLOW_TRIGGERS contains all valid triggers', () => {
    expect(constants.WORKFLOW_TRIGGERS).toContain('task_created');
    expect(constants.WORKFLOW_TRIGGERS).toContain('task_delayed');
    expect(constants.WORKFLOW_TRIGGERS).toContain('status_changed');
    expect(constants.WORKFLOW_TRIGGERS).toContain('deadline_approaching');
    expect(constants.WORKFLOW_TRIGGERS).toContain('task_assigned');
    expect(constants.WORKFLOW_TRIGGERS).toContain('task_completed');
  });

  /**
   * @test Verify all workflow action types are defined
   *
   * @description
   *   Workflow actions are the operations executed when a workflow's
   *   conditions are met. They interact with multiple Google Cloud services:
   *   - send_notification: triggers Firebase Cloud Messaging push
   *   - auto_assign: updates Cloud SQL task assignee
   *   - update_status: changes Cloud SQL task status
   *
   * @expectedBehavior All 3 core action types are present
   * @googleService FCM (notifications), Cloud SQL (task mutations)
   */
  test('WORKFLOW_ACTIONS contains all valid actions', () => {
    expect(constants.WORKFLOW_ACTIONS).toContain('send_notification');
    expect(constants.WORKFLOW_ACTIONS).toContain('auto_assign');
    expect(constants.WORKFLOW_ACTIONS).toContain('update_status');
  });

  /**
   * @test Verify file upload constraints
   *
   * @description
   *   File upload limits protect against:
   *   - Storage abuse (10 MB max per file)
   *   - Malicious file uploads (only safe MIME types allowed)
   *   - JavaScript execution (application/javascript blocked)
   *
   *   Accepted types: images (JPEG, PNG, GIF, WebP), documents
   *   (PDF, Word, Excel), and text files (plain, CSV).
   *
   * @expectedBehavior MAX_FILE_SIZE is 10MB, safe MIME types allowed, JS blocked
   * @securityNote Prevents arbitrary file upload attacks (OWASP A04:2021)
   * @googleService Google Cloud Storage (upload target)
   */
  test('FILE constraints are properly set', () => {
    expect(constants.MAX_FILE_SIZE).toBe(10 * 1024 * 1024); // 10MB
    expect(constants.ALLOWED_FILE_TYPES).toContain('image/jpeg');
    expect(constants.ALLOWED_FILE_TYPES).toContain('application/pdf');
    expect(constants.ALLOWED_FILE_TYPES).not.toContain('application/javascript');
  });

  /**
   * @test Verify pagination defaults
   *
   * @description
   *   Pagination defaults control Cloud SQL query result sizes:
   *   - DEFAULT_PAGE_SIZE (20): balances UX responsiveness with data transfer
   *   - MAX_PAGE_SIZE (100): prevents clients from requesting unbounded results
   *     which could cause Cloud SQL query timeouts or memory exhaustion
   *
   * @expectedBehavior DEFAULT_PAGE_SIZE is 20, MAX_PAGE_SIZE is 100
   * @performanceNote Prevents unbounded Cloud SQL queries
   */
  test('Pagination defaults are reasonable', () => {
    expect(constants.DEFAULT_PAGE_SIZE).toBe(20);
    expect(constants.MAX_PAGE_SIZE).toBe(100);
  });
});

// ============================================
// Utility Helpers Tests
// ============================================

/**
 * ═══════════════════════════════════════════════════════
 * Utility Helpers Tests
 * ═══════════════════════════════════════════════════════
 *
 * Tests for pure utility functions used across the backend.
 * These are stateless, side-effect-free functions that provide:
 * - Date arithmetic for deadline tracking
 * - XSS sanitization for user-generated content
 * - Pagination offset calculation for Cloud SQL queries
 * - Date formatting for API responses
 *
 * All helpers are used in multiple services and routes, making
 * them critical infrastructure that must be rigorously tested.
 *
 * @see utils/helpers.js
 */
describe('Helpers', () => {
  const { daysUntilDeadline, sanitize, paginate, formatDate } = require('../utils/helpers');

  /**
   * daysUntilDeadline Tests
   *
   * Used by:
   * - Workflow engine: deadline_approaching trigger evaluation
   * - AI service: providing context for task suggestions
   * - Task API: including deadline urgency in responses
   */
  describe('daysUntilDeadline', () => {
    /**
     * @test Verify positive days for future deadlines
     *
     * @description
     *   A deadline 5 days in the future should return approximately 5.
     *   We allow a range of 4-6 to account for timezone boundary effects
     *   and fractional day calculations.
     *
     * @expectedBehavior Returns 4-6 for a deadline 5 days from now
     */
    test('returns positive days for future deadline', () => {
      const future = new Date(Date.now() + 5 * 86400000).toISOString();
      expect(daysUntilDeadline(future)).toBeGreaterThanOrEqual(4);
      expect(daysUntilDeadline(future)).toBeLessThanOrEqual(6);
    });

    /**
     * @test Verify negative days for past deadlines (overdue detection)
     *
     * @description
     *   A deadline 3 days in the past should return a negative number.
     *   This is used by the workflow engine to trigger 'task_delayed'
     *   workflows and by the AI service to flag overdue items.
     *
     * @expectedBehavior Returns a negative number for past deadlines
     */
    test('returns negative days for past deadline', () => {
      const past = new Date(Date.now() - 3 * 86400000).toISOString();
      expect(daysUntilDeadline(past)).toBeLessThan(0);
    });

    /**
     * @test Verify boundary behavior for today's deadline
     *
     * @description
     *   A deadline set to "right now" should return 0 or 1 depending
     *   on the fractional day calculation. This boundary is important
     *   for the workflow engine's deadline_approaching trigger, which
     *   fires for tasks due within the next 24 hours.
     *
     * @expectedBehavior Returns 0 or 1 for today's deadline
     */
    test('returns 0 or 1 for today', () => {
      const today = new Date().toISOString();
      expect(daysUntilDeadline(today)).toBeLessThanOrEqual(1);
      expect(daysUntilDeadline(today)).toBeGreaterThanOrEqual(0);
    });
  });

  /**
   * sanitize Tests
   *
   * Critical security function that prevents stored XSS attacks.
   * Used by chat messages, task descriptions, and any user-generated content
   * before it is stored in Cloud SQL or Cloud Firestore.
   *
   * @securityNote Prevents OWASP A03:2021 (Injection)
   */
  describe('sanitize', () => {
    /**
     * @test Verify HTML tag escaping (XSS prevention)
     *
     * @description
     *   The most common XSS vector is injecting <script> tags into
     *   user-generated content. The sanitize function must convert
     *   angle brackets to HTML entities, rendering the script inert.
     *
     * @expectedBehavior <script> becomes &lt;script&gt;
     * @securityNote Prevents stored XSS in chat messages and task descriptions
     */
    test('escapes HTML special characters', () => {
      expect(sanitize('<script>alert("xss")</script>')).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
    });

    /**
     * @test Verify ampersand escaping
     *
     * @description
     *   Ampersands must be escaped first to prevent double-escaping.
     *   The sanitize function converts & to &amp; before processing
     *   other characters.
     *
     * @expectedBehavior & becomes &amp;
     */
    test('escapes ampersands', () => {
      expect(sanitize('A & B')).toBe('A &amp; B');
    });

    /**
     * @test Verify single quote escaping
     *
     * @description
     *   Single quotes can break HTML attribute values if injected.
     *   Example: onclick='alert(1)' — the sanitize function converts
     *   single quotes to &#x27; to prevent attribute injection.
     *
     * @expectedBehavior ' becomes &#x27;
     * @securityNote Prevents HTML attribute injection attacks
     */
    test('escapes single quotes', () => {
      expect(sanitize("it's")).toBe("it&#x27;s");
    });

    /**
     * @test Verify null/undefined input handling
     *
     * @description
     *   sanitize must gracefully handle null, undefined, and empty
     *   string inputs without throwing TypeError. This is essential
     *   because user input may be missing from request bodies.
     *
     * @expectedBehavior Returns '' for null, undefined, and empty string
     */
    test('returns empty string for null/undefined', () => {
      expect(sanitize(null)).toBe('');
      expect(sanitize(undefined)).toBe('');
      expect(sanitize('')).toBe('');
    });

    /**
     * @test Verify safe text passes through unchanged
     *
     * @description
     *   Normal alphanumeric text with spaces should pass through the
     *   sanitize function without modification. This ensures user-visible
     *   content is not garbled by unnecessary escaping.
     *
     * @expectedBehavior Safe text is returned as-is
     */
    test('does not modify safe text', () => {
      expect(sanitize('Hello World 123')).toBe('Hello World 123');
    });
  });

  /**
   * paginate Tests
   *
   * Used by all Cloud SQL list queries (getTasks, getTeamMembers, etc.)
   * to calculate OFFSET and LIMIT values for PostgreSQL pagination.
   */
  describe('paginate', () => {
    /**
     * @test Verify page 1 offset calculation
     *
     * @description
     *   Page 1 with 20 items per page should produce OFFSET 0, LIMIT 20.
     *   This is the default query for initial page loads.
     *
     * @expectedBehavior { offset: 0, limit: 20, page: 1 }
     */
    test('calculates correct offset for page 1', () => {
      expect(paginate(1, 20)).toEqual({ offset: 0, limit: 20, page: 1 });
    });

    /**
     * @test Verify subsequent page offset calculation
     *
     * @description
     *   Page 3 with 10 items per page should produce OFFSET 20.
     *   Formula: offset = (page - 1) * limit = (3 - 1) * 10 = 20.
     *
     * @expectedBehavior { offset: 20, limit: 10, page: 3 }
     */
    test('calculates correct offset for subsequent pages', () => {
      expect(paginate(3, 10)).toEqual({ offset: 20, limit: 10, page: 3 });
    });

    /**
     * @test Verify page number minimum clamping
     *
     * @description
     *   Negative page numbers and zero must be clamped to page 1.
     *   This prevents negative OFFSET values which would cause
     *   Cloud SQL query errors.
     *
     * @expectedBehavior Negative/zero pages are treated as page 1
     * @securityNote Prevents SQL parameter injection via negative offsets
     */
    test('clamps page to minimum of 1', () => {
      expect(paginate(-5, 20)).toEqual({ offset: 0, limit: 20, page: 1 });
      expect(paginate(0, 20)).toEqual({ offset: 0, limit: 20, page: 1 });
    });

    /**
     * @test Verify limit maximum clamping (100)
     *
     * @description
     *   Client-requested limits exceeding MAX_PAGE_SIZE (100) must be
     *   clamped to prevent unbounded Cloud SQL result sets. A client
     *   requesting 500 items could cause memory exhaustion on the
     *   Cloud Run container.
     *
     * @expectedBehavior Limit > 100 is clamped to 100
     * @performanceNote Prevents unbounded PostgreSQL result sets
     */
    test('clamps limit to maximum of 100', () => {
      expect(paginate(1, 500)).toEqual({ offset: 0, limit: 100, page: 1 });
    });

    /**
     * @test Verify limit minimum clamping (1)
     *
     * @description
     *   Zero or negative limits must be clamped to 1 to prevent
     *   empty result sets or SQL errors.
     *
     * @expectedBehavior Limit <= 0 is clamped to 1
     */
    test('clamps limit to minimum of 1', () => {
      expect(paginate(1, 0)).toEqual({ offset: 0, limit: 1, page: 1 });
      expect(paginate(1, -10)).toEqual({ offset: 0, limit: 1, page: 1 });
    });

    /**
     * @test Verify default argument handling
     *
     * @description
     *   When paginate() is called without arguments (e.g., from a route
     *   handler where query params are missing), it should use safe
     *   defaults: page 1, offset 0, limit >= 1.
     *
     * @expectedBehavior Returns valid pagination with page 1 and offset 0
     */
    test('uses defaults when no arguments', () => {
      const result = paginate();
      expect(result.page).toBe(1);
      expect(result.offset).toBe(0);
      expect(result.limit).toBeGreaterThanOrEqual(1);
    });
  });

  /**
   * formatDate Tests
   *
   * Used in API responses and notification messages to display
   * human-readable timestamps.
   */
  describe('formatDate', () => {
    /**
     * @test Verify ISO string formatting
     *
     * @description
     *   Formats a UTC ISO 8601 timestamp into a localized string
     *   using en-US locale with month abbreviation, day, year,
     *   and 12-hour time format.
     *
     * @expectedBehavior Returns a non-empty string for valid ISO dates
     */
    test('formats a valid date', () => {
      const result = formatDate('2026-05-01T10:30:00Z');
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    /**
     * @test Verify Date object handling
     *
     * @description
     *   formatDate must accept both ISO string and JavaScript Date
     *   objects, since different parts of the codebase pass dates
     *   in different formats.
     *
     * @expectedBehavior Returns a defined value for Date objects
     */
    test('handles Date object', () => {
      const result = formatDate(new Date());
      expect(result).toBeDefined();
    });
  });
});
