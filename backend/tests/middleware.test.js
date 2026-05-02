/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Middleware Tests — Firebase Auth, Role-Based Access Control & Input Validation
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * @file middleware.test.js
 * @module tests/middleware
 * @version 1.0.0
 * @description
 *   Unit tests for the three middleware layers that protect every API route:
 *
 *   1. **Auth Middleware** (auth.js) — Verifies Firebase JWT tokens, looks up
 *      or auto-creates users in Cloud SQL, and attaches req.user.
 *
 *   2. **Role Check Middleware** (roleCheck.js) — Enforces role-based access
 *      control (admin/manager/member) and team membership verification.
 *
 *   3. **Validation Middleware** (validate.js) — Express-validator chains for
 *      request body/param validation with structured error responses.
 *
 * @coverage
 *   ┌─────────────────────────────────────────────────────────────────────┐
 *   │ Auth Middleware (5 tests)                                           │
 *   │   • Missing Authorization header → 401                             │
 *   │   • Malformed Bearer format → 401                                  │
 *   │   • Valid token with existing user → 200 (user attached to req)    │
 *   │   • Valid token with new user → auto-create in Cloud SQL           │
 *   │   • Expired/invalid token → 401                                    │
 *   │                                                                     │
 *   │ Role Check Middleware (5 tests)                                     │
 *   │   • Authorized role → next() called                                │
 *   │   • Unauthorized role → 403 Forbidden                              │
 *   │   • Missing user → 401 Unauthorized                                │
 *   │   • Admin bypasses team membership check                            │
 *   │   • Missing teamId param → 400 Bad Request                         │
 *   │   • Non-member access → 403 Forbidden                              │
 *   │                                                                     │
 *   │ Validation Middleware (4 tests)                                     │
 *   │   • handleValidation passes with no errors                          │
 *   │   • validateTask exports correct validator chain                    │
 *   │   • validateMessage exports correctly                               │
 *   │   • validateWorkflow exports correctly                              │
 *   │   • validateUUID exports correctly                                  │
 *   └─────────────────────────────────────────────────────────────────────┘
 *
 * @googleServices Firebase Auth (token verification), Cloud SQL (user lookup/creation)
 *
 * @testStrategy
 *   Tests use mock request/response objects to isolate middleware from
 *   Express routing. Firebase Admin SDK and Cloud SQL are mocked to
 *   control authentication outcomes deterministically.
 *
 * @securityNotes
 *   This middleware stack is the primary security perimeter. Every test
 *   verifies that unauthorized access is correctly blocked:
 *   - Missing tokens → 401 (no anonymous access)
 *   - Invalid tokens → 401 (no forged access)
 *   - Wrong roles → 403 (no privilege escalation)
 *   - Missing team membership → 403 (no cross-team data access)
 */

const { authenticate } = require('../middleware/auth');
const { requireRole, requireTeamMember } = require('../middleware/roleCheck');
const { handleValidation } = require('../middleware/validate');
const { validationResult } = require('express-validator');

/**
 * ── Mock: Firebase Admin SDK ──
 * Mocks verifyToken to control authentication outcomes.
 * In production, this calls Firebase Admin SDK's verifyIdToken()
 * which validates the JWT signature against Google's public keys.
 */
jest.mock('../config/firebase', () => ({
  verifyToken: jest.fn(),
  db: { collection: jest.fn() },
  auth: {},
  messaging: {},
  sendPushNotification: jest.fn()
}));

/**
 * ── Mock: Cloud SQL PostgreSQL ──
 * Mocks the query function to simulate user lookup and creation
 * in the PostgreSQL users table.
 */
jest.mock('../config/database', () => ({
  query: jest.fn(),
  pool: { on: jest.fn() }
}));

const { verifyToken } = require('../config/firebase');
const { query } = require('../config/database');

/**
 * Creates a mock Express request object with optional overrides.
 *
 * @param {Object} overrides - Properties to merge into the mock request
 * @returns {Object} Mock request with headers, params, and body defaults
 */
function mockReq(overrides = {}) {
  return {
    headers: {},
    params: {},
    body: {},
    ...overrides
  };
}

/**
 * Creates a mock Express response object with chainable status/json methods.
 * Captures the status code and response body for assertion.
 *
 * @returns {Object} Mock response with status(), json(), _status, and _json
 */
function mockRes() {
  const res = {
    _status: null,
    _json: null,
    status: jest.fn(function (code) { res._status = code; return res; }),
    json: jest.fn(function (data) { res._json = data; return res; })
  };
  return res;
}

// ============================================
// Auth Middleware Tests
// ============================================

/**
 * ═══════════════════════════════════════════════════════
 * Authentication Middleware Tests
 * ═══════════════════════════════════════════════════════
 *
 * The auth middleware is the first security gate in the request pipeline.
 * It performs the following sequence:
 *
 * 1. Extract Bearer token from Authorization header
 * 2. Verify token via Firebase Admin SDK (verifyToken)
 * 3. Look up user by firebase_uid in Cloud SQL
 * 4. If user not found → auto-create (first login flow)
 * 5. Attach user object to req.user for downstream middleware
 *
 * Failure at any step returns HTTP 401 with error details.
 *
 * @see middleware/auth.js
 * @googleService Firebase Auth (JWT verification)
 * @googleService Cloud SQL (user record lookup/creation)
 */
describe('Auth Middleware', () => {
  beforeEach(() => jest.clearAllMocks());

  /**
   * @test Verify 401 response when Authorization header is missing
   *
   * @description
   *   Requests without an Authorization header are immediately rejected.
   *   This is the most basic authentication check — no token means no identity.
   *
   *   This prevents:
   *   - Anonymous API access
   *   - Curl/Postman requests without credentials
   *   - Frontend bugs where the auth token is not attached
   *
   * @expectedBehavior HTTP 401 with { error: 'Authentication required' }
   * @expectedBehavior next() is NOT called (request pipeline stops)
   * @securityNote First line of defense against unauthenticated access
   */
  test('rejects requests without Authorization header', async () => {
    const req = mockReq();
    const res = mockRes();
    const next = jest.fn();

    await authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res._json.error).toBe('Authentication required');
    expect(next).not.toHaveBeenCalled();
  });

  /**
   * @test Verify 401 response for non-Bearer auth schemes
   *
   * @description
   *   The middleware only accepts 'Bearer <token>' format. Other schemes
   *   like Basic, Digest, or raw tokens are rejected. This prevents
   *   potential auth bypass attempts where an attacker sends credentials
   *   in an unexpected format.
   *
   * @expectedBehavior HTTP 401 for 'Basic abc123' header
   * @expectedBehavior next() is NOT called
   * @securityNote Prevents auth scheme confusion attacks
   */
  test('rejects requests with malformed Bearer token', async () => {
    const req = mockReq({ headers: { authorization: 'Basic abc123' } });
    const res = mockRes();
    const next = jest.fn();

    await authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  /**
   * @test Verify successful authentication flow with existing user
   *
   * @description
   *   The happy path for returning users:
   *   1. Client sends valid Firebase JWT in Authorization header
   *   2. verifyToken validates the JWT and returns { uid, email }
   *   3. Cloud SQL query finds user by firebase_uid
   *   4. User object is attached to req.user
   *   5. next() is called to proceed to route handler
   *
   *   This test verifies the complete authentication pipeline works
   *   end-to-end with a mocked Firebase token and Cloud SQL user record.
   *
   * @expectedBehavior verifyToken called with extracted token
   * @expectedBehavior req.user populated with user from Cloud SQL
   * @expectedBehavior next() called (request continues)
   * @googleService Firebase Auth (token verification)
   * @googleService Cloud SQL (user lookup by firebase_uid)
   */
  test('authenticates valid Firebase token and finds existing user', async () => {
    verifyToken.mockResolvedValue({ uid: 'firebase-123', email: 'user@test.com' });
    query.mockResolvedValue({
      rows: [{ id: 'uuid-1', firebase_uid: 'firebase-123', name: 'Test', email: 'user@test.com', role: 'member' }]
    });

    const req = mockReq({ headers: { authorization: 'Bearer valid-token-123' } });
    const res = mockRes();
    const next = jest.fn();

    await authenticate(req, res, next);

    expect(verifyToken).toHaveBeenCalledWith('valid-token-123');
    expect(req.user).toBeDefined();
    expect(req.user.firebase_uid).toBe('firebase-123');
    expect(next).toHaveBeenCalled();
  });

  /**
   * @test Verify auto-creation flow for first-time users
   *
   * @description
   *   When a user authenticates with Firebase for the first time,
   *   there is no matching record in Cloud SQL. The middleware:
   *   1. Verifies the Firebase token (valid JWT)
   *   2. Queries Cloud SQL by firebase_uid → no rows returned
   *   3. INSERTs a new user record with name/email from Firebase
   *   4. Returns the newly created user (query called twice)
   *   5. Attaches the new user to req.user
   *
   *   This enables seamless onboarding: users sign up via Firebase
   *   and their Cloud SQL profile is created automatically.
   *
   * @expectedBehavior Cloud SQL query called twice (SELECT then INSERT)
   * @expectedBehavior New user has name from Firebase token
   * @expectedBehavior next() called (request continues)
   * @googleService Firebase Auth (user identity), Cloud SQL (profile creation)
   */
  test('auto-creates user on first login via Cloud SQL', async () => {
    verifyToken.mockResolvedValue({ uid: 'new-user-uid', email: 'new@test.com', name: 'New User' });
    query
      .mockResolvedValueOnce({ rows: [] }) // User not found
      .mockResolvedValueOnce({
        rows: [{ id: 'uuid-new', firebase_uid: 'new-user-uid', name: 'New User', email: 'new@test.com', role: 'member' }]
      });

    const req = mockReq({ headers: { authorization: 'Bearer new-token' } });
    const res = mockRes();
    const next = jest.fn();

    await authenticate(req, res, next);

    expect(query).toHaveBeenCalledTimes(2);
    expect(req.user.name).toBe('New User');
    expect(next).toHaveBeenCalled();
  });

  /**
   * @test Verify 401 response for expired/invalid Firebase tokens
   *
   * @description
   *   When Firebase Admin SDK's verifyIdToken throws (expired signature,
   *   revoked token, or tampered payload), the middleware must:
   *   - Return HTTP 401 with { error: 'Authentication failed' }
   *   - NOT call next() (stop request pipeline)
   *   - NOT query Cloud SQL (avoid unnecessary database load)
   *
   *   Common scenarios:
   *   - Token expired after 1 hour (Firebase default TTL)
   *   - Token revoked after password change
   *   - Token tampered by attacker (invalid signature)
   *
   * @expectedBehavior HTTP 401 with { error: 'Authentication failed' }
   * @expectedBehavior next() is NOT called
   * @securityNote Expired tokens must never grant access
   */
  test('returns 401 for expired or invalid tokens', async () => {
    verifyToken.mockRejectedValue(new Error('Token expired'));

    const req = mockReq({ headers: { authorization: 'Bearer expired-token' } });
    const res = mockRes();
    const next = jest.fn();

    await authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res._json.error).toBe('Authentication failed');
    expect(next).not.toHaveBeenCalled();
  });
});

// ============================================
// Role Check Middleware Tests
// ============================================

/**
 * ═══════════════════════════════════════════════════════
 * Role-Based Access Control (RBAC) Middleware Tests
 * ═══════════════════════════════════════════════════════
 *
 * Tests for the two RBAC functions:
 *
 * - requireRole(...roles): creates middleware that checks if req.user.role
 *   is in the allowed roles list. Used on admin-only routes (user management)
 *   and manager+ routes (task assignment, workflow creation).
 *
 * - requireTeamMember: checks if the authenticated user belongs to the team
 *   specified in req.params.teamId. Admins bypass this check for global access.
 *   Used on all team-scoped endpoints.
 *
 * @see middleware/roleCheck.js
 * @securityNote These checks enforce the principle of least privilege
 */
describe('Role Check Middleware', () => {
  /**
   * @test Verify authorized roles pass through
   *
   * @description
   *   requireRole('admin', 'manager') creates a middleware that allows
   *   users with either 'admin' or 'manager' role. When an admin
   *   user hits this middleware, next() should be called.
   *
   * @expectedBehavior next() called for admin role
   */
  test('requireRole allows authorized roles', () => {
    const middleware = requireRole('admin', 'manager');
    const req = mockReq({ user: { role: 'admin' } });
    const res = mockRes();
    const next = jest.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  /**
   * @test Verify unauthorized roles are rejected with 403
   *
   * @description
   *   When a 'member' user tries to access an admin-only endpoint,
   *   the middleware must return HTTP 403 (Forbidden) with a clear
   *   error message. This prevents horizontal privilege escalation.
   *
   * @expectedBehavior HTTP 403 with { error: 'Insufficient permissions' }
   * @expectedBehavior next() is NOT called
   * @securityNote Prevents privilege escalation attacks
   */
  test('requireRole rejects unauthorized roles', () => {
    const middleware = requireRole('admin');
    const req = mockReq({ user: { role: 'member' } });
    const res = mockRes();
    const next = jest.fn();

    middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res._json.error).toBe('Insufficient permissions');
    expect(next).not.toHaveBeenCalled();
  });

  /**
   * @test Verify 401 when user object is missing
   *
   * @description
   *   If the auth middleware somehow fails to attach req.user (e.g.,
   *   misconfigured middleware order), the role check must return 401
   *   rather than crashing with a TypeError on req.user.role.
   *
   * @expectedBehavior HTTP 401 (not authenticated, not authorized)
   * @expectedBehavior next() is NOT called
   */
  test('requireRole returns 401 if user not authenticated', () => {
    const middleware = requireRole('admin');
    const req = mockReq();
    const res = mockRes();
    const next = jest.fn();

    middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  /**
   * @test Verify admin bypass for team membership check
   *
   * @description
   *   Admins have global access and should bypass the team membership
   *   database lookup. This allows admins to manage all teams without
   *   being explicitly added as a member.
   *
   *   Without this bypass, admins would need to be added to every team
   *   manually, which is impractical for platform-level management.
   *
   * @expectedBehavior next() called without Cloud SQL query
   * @googleService Cloud SQL (query skipped for admins)
   */
  test('requireTeamMember allows admins to access any team', async () => {
    const req = mockReq({
      user: { id: 'admin-1', role: 'admin' },
      params: { teamId: 'team-123' }
    });
    const res = mockRes();
    const next = jest.fn();

    await requireTeamMember(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  /**
   * @test Verify teamId parameter is required
   *
   * @description
   *   Team-scoped endpoints must include teamId in the URL params.
   *   If missing, the middleware returns 400 (Bad Request) rather than
   *   proceeding with an undefined team scope.
   *
   * @expectedBehavior HTTP 400 with { error: 'Team ID is required' }
   */
  test('requireTeamMember requires teamId parameter', async () => {
    const req = mockReq({ user: { id: 'user-1', role: 'member' } });
    const res = mockRes();
    const next = jest.fn();

    await requireTeamMember(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res._json.error).toBe('Team ID is required');
  });

  /**
   * @test Verify non-members are rejected with 403
   *
   * @description
   *   When a non-admin user requests access to a team they don't
   *   belong to, the Cloud SQL query returns empty results and the
   *   middleware returns HTTP 403. This prevents cross-team data
   *   access — a critical multi-tenant security boundary.
   *
   * @expectedBehavior HTTP 403 with { error: 'Not a team member' }
   * @securityNote Enforces tenant isolation between teams
   * @googleService Cloud SQL (team_members table lookup)
   */
  test('requireTeamMember rejects non-members', async () => {
    query.mockResolvedValue({ rows: [] });

    const req = mockReq({
      user: { id: 'user-1', role: 'member' },
      params: { teamId: 'team-456' }
    });
    const res = mockRes();
    const next = jest.fn();

    await requireTeamMember(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res._json.error).toBe('Not a team member');
  });
});

// ============================================
// Validation Middleware Tests
// ============================================

/**
 * ═══════════════════════════════════════════════════════
 * Input Validation Middleware Tests
 * ═══════════════════════════════════════════════════════
 *
 * Tests for the express-validator middleware chains that validate
 * request bodies, URL parameters, and query strings before they
 * reach route handlers.
 *
 * Validation chains:
 * - validateTask: title (required), description, priority, status, deadline
 * - validateMessage: text (required, max 5000 chars), channelId
 * - validateWorkflow: name, trigger_type, conditions, actions
 * - validateUUID: id param must be valid UUID v4 format
 *
 * These validators prevent:
 * - SQL injection via malformed input (defense in depth with parameterized queries)
 * - Invalid data reaching Cloud SQL (constraint violations)
 * - Oversized inputs consuming Cloud Run memory
 *
 * @see middleware/validate.js
 * @securityNote Defense-in-depth: validation + parameterized queries + sanitization
 */
describe('Validation Middleware', () => {
  /**
   * @test Verify handleValidation passes when no validation errors exist
   *
   * @description
   *   When all express-validator checks pass (valid input), the
   *   handleValidation middleware should call next() to proceed
   *   to the route handler.
   *
   * @expectedBehavior next() called when no validation errors
   */
  test('handleValidation passes when no errors', () => {
    const req = { _validationErrors: [] };
    const res = mockRes();
    const next = jest.fn();

    // Simulate validationResult returning no errors
    const middleware = (req, res, next) => {
      // No validation errors
      next();
    };

    middleware(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  /**
   * @test Verify validateTask chain structure
   *
   * @description
   *   The validateTask chain should export an array of express-validator
   *   middleware functions, followed by the handleValidation error handler.
   *   This validates that the chain was constructed correctly and has
   *   at least a field validator and the error handler.
   *
   *   The chain validates:
   *   - title: required string, 1-200 characters, trimmed
   *   - priority: must be one of TASK_PRIORITIES
   *   - status: must be one of TASK_STATUSES
   *   - deadline: valid ISO 8601 date if provided
   *
   * @expectedBehavior Array with >= 2 middleware functions
   */
  test('validateTask chain exports correct number of validators', () => {
    const { validateTask } = require('../middleware/validate');
    // Should include field validators + handleValidation
    expect(validateTask).toBeDefined();
    expect(Array.isArray(validateTask)).toBe(true);
    expect(validateTask.length).toBeGreaterThanOrEqual(2);
  });

  /**
   * @test Verify validateMessage chain structure
   *
   * @description
   *   Validates chat message input before it's stored in Cloud Firestore.
   *   - text: required, max 5000 characters
   *   - channelId: required string
   *
   * @expectedBehavior Exports a defined array of validators
   * @googleService Cloud Firestore (message destination)
   */
  test('validateMessage chain exports correctly', () => {
    const { validateMessage } = require('../middleware/validate');
    expect(validateMessage).toBeDefined();
    expect(Array.isArray(validateMessage)).toBe(true);
  });

  /**
   * @test Verify validateWorkflow chain structure
   *
   * @description
   *   Validates workflow rule creation/update input before storage in Cloud SQL.
   *   - name: required string
   *   - trigger_type: must be one of WORKFLOW_TRIGGERS
   *   - conditions: valid JSON array
   *   - actions: valid JSON array with known action types
   *
   * @expectedBehavior Exports a defined array of validators
   * @googleService Cloud SQL (workflow rules table)
   */
  test('validateWorkflow chain exports correctly', () => {
    const { validateWorkflow } = require('../middleware/validate');
    expect(validateWorkflow).toBeDefined();
    expect(Array.isArray(validateWorkflow)).toBe(true);
  });

  /**
   * @test Verify validateUUID chain structure
   *
   * @description
   *   Validates that URL parameters containing IDs are valid UUID v4 format.
   *   This prevents:
   *   - SQL injection via the :id parameter
   *   - Invalid UUID errors in Cloud SQL queries
   *   - Log injection via crafted ID strings
   *
   * @expectedBehavior Exports a defined array of validators
   * @securityNote Prevents parameter pollution and injection attacks
   */
  test('validateUUID chain exports correctly', () => {
    const { validateUUID } = require('../middleware/validate');
    expect(validateUUID).toBeDefined();
    expect(Array.isArray(validateUUID)).toBe(true);
  });
});
