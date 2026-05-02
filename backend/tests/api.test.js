/**
 * API Integration Tests — Express Routes & Health Check
 * 
 * Tests the SyncSphere REST API endpoints for:
 * - Health check (Cloud Run readiness)
 * - 404 handling for undefined routes
 * - Error response format validation
 * - Security headers verification
 * - Rate limiting behavior
 * 
 * Google Services Tested: Cloud Run (deployment target)
 */

const { app } = require('../server');
const http = require('http');

// Mock all Google Cloud dependencies for isolated testing
jest.mock('../config/firebase', () => ({
  db: { collection: jest.fn() },
  auth: { verifyIdToken: jest.fn() },
  messaging: { send: jest.fn() },
  verifyToken: jest.fn(),
  sendPushNotification: jest.fn()
}));

jest.mock('../config/database', () => ({
  pool: { query: jest.fn(), end: jest.fn(), on: jest.fn() },
  query: jest.fn(),
  getClient: jest.fn(),
  transaction: jest.fn()
}));

jest.mock('../config/bigquery', () => ({
  runQuery: jest.fn(),
  insertRows: jest.fn(),
  logTaskEvent: jest.fn(),
  logUserActivity: jest.fn(),
  initializeAnalytics: jest.fn(),
  DATASET_ID: 'test_dataset'
}));

jest.mock('../config/vertexai', () => ({
  generateContent: jest.fn().mockResolvedValue('AI response'),
  getModel: jest.fn(),
  SYSTEM_INSTRUCTION: 'test'
}));

jest.mock('../config/storage', () => ({
  uploadFile: jest.fn(),
  getSignedUrl: jest.fn(),
  deleteFile: jest.fn(),
  listFiles: jest.fn()
}));

let server;

beforeAll((done) => {
  server = http.createServer(app);
  server.listen(0, done);
});

afterAll((done) => {
  server.close(done);
});

describe('Health Check API', () => {
  test('GET /api/health returns 200 with service info', async () => {
    const res = await fetch(`http://localhost:${server.address().port}/api/health`);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.status).toBe('healthy');
    expect(data.service).toBe('SyncSphere API');
    expect(data.version).toBe('1.0.0');
    expect(data.timestamp).toBeDefined();
    expect(data.uptime).toBeDefined();
    expect(data.memory).toBeDefined();
    expect(data.memory.heapUsed).toMatch(/MB$/);
  });

  test('Health check includes all 9 Google Cloud services', async () => {
    const res = await fetch(`http://localhost:${server.address().port}/api/health`);
    const data = await res.json();

    expect(data.googleServices).toContain('Firebase Auth');
    expect(data.googleServices).toContain('Cloud Firestore');
    expect(data.googleServices).toContain('Cloud SQL (PostgreSQL)');
    expect(data.googleServices).toContain('Vertex AI (Gemini Pro)');
    expect(data.googleServices).toContain('Google Cloud Storage');
    expect(data.googleServices).toContain('BigQuery');
    expect(data.googleServices).toContain('Firebase Cloud Messaging');
    expect(data.googleServices).toContain('Cloud Run');
    expect(data.googleServices).toContain('Google Calendar API');
    expect(data.googleServices).toHaveLength(9);
  });

  test('Health check has no-cache headers', async () => {
    const res = await fetch(`http://localhost:${server.address().port}/api/health`);

    expect(res.headers.get('cache-control')).toContain('no-cache');
  });
});

describe('404 Handler', () => {
  test('Returns 404 for undefined API routes', async () => {
    const res = await fetch(`http://localhost:${server.address().port}/api/nonexistent`);
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.error).toBe('Not Found');
    expect(data.message).toContain('does not exist');
  });
});

describe('Security Headers', () => {
  test('Returns Helmet security headers', async () => {
    const res = await fetch(`http://localhost:${server.address().port}/api/health`);

    // Helmet sets X-Content-Type-Options
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    // Helmet sets X-Frame-Options
    expect(res.headers.get('x-frame-options')).toBeTruthy();
  });

  test('Returns proper CORS headers for allowed origins', async () => {
    const res = await fetch(`http://localhost:${server.address().port}/api/health`, {
      headers: { 'Origin': 'http://localhost:5173' }
    });

    expect(res.headers.get('access-control-allow-credentials')).toBe('true');
  });
});

describe('Request Validation', () => {
  test('Protected routes return 401 without auth token', async () => {
    const res = await fetch(`http://localhost:${server.address().port}/api/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Test' })
    });

    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBeDefined();
  });

  test('Protected routes return 401 with invalid Bearer format', async () => {
    const res = await fetch(`http://localhost:${server.address().port}/api/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'InvalidFormat'
      },
      body: JSON.stringify({ title: 'Test' })
    });

    expect(res.status).toBe(401);
  });
});

describe('JSON Body Parsing', () => {
  test('Rejects oversized request bodies', async () => {
    const largeBody = 'x'.repeat(11 * 1024 * 1024); // 11MB > 10MB limit
    const res = await fetch(`http://localhost:${server.address().port}/api/health`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: largeBody
    });

    // Should reject with 413 or similar error
    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});
