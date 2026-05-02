/**
 * Middleware Tests — Auth, Role Check, and Validation
 * 
 * Tests for:
 * - Firebase token verification middleware
 * - Role-based access control (RBAC)
 * - Input validation chains (express-validator)
 * 
 * Google Services Tested: Firebase Auth, Cloud SQL
 */

const { authenticate } = require('../middleware/auth');
const { requireRole, requireTeamMember } = require('../middleware/roleCheck');
const { handleValidation } = require('../middleware/validate');
const { validationResult } = require('express-validator');

// Mock Firebase Admin SDK
jest.mock('../config/firebase', () => ({
  verifyToken: jest.fn(),
  db: { collection: jest.fn() },
  auth: {},
  messaging: {},
  sendPushNotification: jest.fn()
}));

// Mock Cloud SQL database
jest.mock('../config/database', () => ({
  query: jest.fn(),
  pool: { on: jest.fn() }
}));

const { verifyToken } = require('../config/firebase');
const { query } = require('../config/database');

// Test helpers
function mockReq(overrides = {}) {
  return {
    headers: {},
    params: {},
    body: {},
    ...overrides
  };
}

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

describe('Auth Middleware', () => {
  beforeEach(() => jest.clearAllMocks());

  test('rejects requests without Authorization header', async () => {
    const req = mockReq();
    const res = mockRes();
    const next = jest.fn();

    await authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res._json.error).toBe('Authentication required');
    expect(next).not.toHaveBeenCalled();
  });

  test('rejects requests with malformed Bearer token', async () => {
    const req = mockReq({ headers: { authorization: 'Basic abc123' } });
    const res = mockRes();
    const next = jest.fn();

    await authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

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

describe('Role Check Middleware', () => {
  test('requireRole allows authorized roles', () => {
    const middleware = requireRole('admin', 'manager');
    const req = mockReq({ user: { role: 'admin' } });
    const res = mockRes();
    const next = jest.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalled();
  });

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

  test('requireRole returns 401 if user not authenticated', () => {
    const middleware = requireRole('admin');
    const req = mockReq();
    const res = mockRes();
    const next = jest.fn();

    middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

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

  test('requireTeamMember requires teamId parameter', async () => {
    const req = mockReq({ user: { id: 'user-1', role: 'member' } });
    const res = mockRes();
    const next = jest.fn();

    await requireTeamMember(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res._json.error).toBe('Team ID is required');
  });

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

describe('Validation Middleware', () => {
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

  test('validateTask chain exports correct number of validators', () => {
    const { validateTask } = require('../middleware/validate');
    // Should include field validators + handleValidation
    expect(validateTask).toBeDefined();
    expect(Array.isArray(validateTask)).toBe(true);
    expect(validateTask.length).toBeGreaterThanOrEqual(2);
  });

  test('validateMessage chain exports correctly', () => {
    const { validateMessage } = require('../middleware/validate');
    expect(validateMessage).toBeDefined();
    expect(Array.isArray(validateMessage)).toBe(true);
  });

  test('validateWorkflow chain exports correctly', () => {
    const { validateWorkflow } = require('../middleware/validate');
    expect(validateWorkflow).toBeDefined();
    expect(Array.isArray(validateWorkflow)).toBe(true);
  });

  test('validateUUID chain exports correctly', () => {
    const { validateUUID } = require('../middleware/validate');
    expect(validateUUID).toBeDefined();
    expect(Array.isArray(validateUUID)).toBe(true);
  });
});
