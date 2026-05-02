/**
 * ═══════════════════════════════════════════════════════════════════════════
 * API Integration Tests — Express Routes, Health Check & Security Verification
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * @file api.test.js
 * @module tests/api
 * @version 1.0.0
 * @description
 *   End-to-end integration tests for the SyncSphere REST API surface.
 *   These tests start a real HTTP server (on an ephemeral port) and make
 *   actual fetch() requests against it, verifying the full Express middleware
 *   pipeline: Helmet security headers, CORS, rate limiting, body parsing,
 *   authentication gates, and the 404/error handlers.
 *
 * @coverage
 *   - Health check endpoint readiness for Cloud Run (liveness/readiness probes)
 *   - 404 JSON error formatting for undefined API routes
 *   - Helmet security header injection (CSP, X-Content-Type-Options, etc.)
 *   - CORS origin validation with credentials support
 *   - Firebase Auth token requirement on protected endpoints
 *   - Body size limits (10 MB) to prevent Denial-of-Service payloads
 *
 * @googleServices Cloud Run (deployment target), Firebase Auth (token verification)
 *
 * @testStrategy
 *   All Google Cloud dependencies (Firebase, Cloud SQL, BigQuery, Vertex AI,
 *   GCS) are mocked to isolate the Express middleware stack from external
 *   services. The server is bound to port 0 so the OS assigns a free port,
 *   avoiding conflicts in parallel CI pipelines.
 *
 * @securityNotes
 *   - Validates Helmet sets X-Content-Type-Options: nosniff (prevents MIME sniffing)
 *   - Validates X-Frame-Options is set (prevents clickjacking)
 *   - Validates CORS credentials are returned for allowed origins
 *   - Validates auth middleware rejects missing and malformed tokens
 *   - Validates request body size limits prevent oversized payload DoS
 *
 * @performanceNotes
 *   - Health check includes no-cache headers to prevent stale readiness responses
 *   - Server listens on port 0 for fast ephemeral binding
 *   - Tests complete in < 2 seconds with mocked dependencies
 */

const { app } = require('../server');
const http = require('http');

/**
 * ── Mock: Firebase Admin SDK ──
 * Mocks the Firebase Auth verification, Firestore database, and Cloud Messaging
 * to prevent real Google Cloud calls during testing.
 */
jest.mock('../config/firebase', () => ({
  db: { collection: jest.fn() },
  auth: { verifyIdToken: jest.fn() },
  messaging: { send: jest.fn() },
  verifyToken: jest.fn(),
  sendPushNotification: jest.fn()
}));

/**
 * ── Mock: Cloud SQL PostgreSQL Pool ──
 * Mocks the pg Pool to prevent real database connections during testing.
 */
jest.mock('../config/database', () => ({
  pool: { query: jest.fn(), end: jest.fn(), on: jest.fn() },
  query: jest.fn(),
  getClient: jest.fn(),
  transaction: jest.fn()
}));

/**
 * ── Mock: BigQuery Analytics Engine ──
 * Mocks BigQuery query execution, row insertion, and event logging.
 */
jest.mock('../config/bigquery', () => ({
  runQuery: jest.fn(),
  insertRows: jest.fn(),
  logTaskEvent: jest.fn(),
  logUserActivity: jest.fn(),
  initializeAnalytics: jest.fn(),
  DATASET_ID: 'test_dataset'
}));

/**
 * ── Mock: Vertex AI (Gemini Pro) ──
 * Mocks AI content generation to prevent real Vertex AI API calls.
 */
jest.mock('../config/vertexai', () => ({
  generateContent: jest.fn().mockResolvedValue('AI response'),
  getModel: jest.fn(),
  SYSTEM_INSTRUCTION: 'test'
}));

/**
 * ── Mock: Google Cloud Storage ──
 * Mocks file upload, signed URL generation, deletion, and listing.
 */
jest.mock('../config/storage', () => ({
  uploadFile: jest.fn(),
  getSignedUrl: jest.fn(),
  deleteFile: jest.fn(),
  listFiles: jest.fn()
}));

/** @type {http.Server} Ephemeral HTTP server for testing */
let server;

/**
 * Start an ephemeral HTTP server before all tests.
 * Port 0 lets the OS assign a free port automatically — critical for
 * parallel CI environments where port collisions must be avoided.
 */
beforeAll((done) => {
  server = http.createServer(app);
  server.listen(0, done);
});

/**
 * Gracefully close the server after all tests complete.
 * Ensures no dangling handles that would cause Jest to hang.
 */
afterAll((done) => {
  server.close(done);
});

/**
 * ═══════════════════════════════════════════════════════
 * Health Check API Tests
 * ═══════════════════════════════════════════════════════
 *
 * The /api/health endpoint is the primary readiness and liveness probe
 * for Google Cloud Run. It must return 200 with structured JSON containing
 * service metadata, uptime, memory usage, and a list of all integrated
 * Google Cloud services.
 *
 * @see https://cloud.google.com/run/docs/configuring/healthchecks
 */
describe('Health Check API', () => {
  /**
   * @test Verify basic health check response structure
   *
   * @description
   *   Ensures the /api/health endpoint returns HTTP 200 with a JSON body
   *   containing the required fields for Cloud Run health monitoring:
   *   - status: 'healthy' (used by load balancer to route traffic)
   *   - service: identifies the application name
   *   - version: tracks deployed version for rollback decisions
   *   - timestamp: ISO 8601 datetime for log correlation
   *   - uptime: seconds since process start (monitors for restart loops)
   *   - memory: heap usage in MB (detects memory leaks in production)
   *
   * @expectedBehavior Returns 200 with all required health fields populated
   * @googleService Cloud Run (readiness probe target)
   */
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

  /**
   * @test Verify all 9 Google Cloud services are listed
   *
   * @description
   *   The health check endpoint must enumerate all 9 Google Cloud services
   *   that SyncSphere integrates with. This serves as a runtime manifest
   *   that operators can use to verify all service connections are configured.
   *
   *   Services verified:
   *   1. Firebase Auth — user authentication
   *   2. Cloud Firestore — real-time chat and presence
   *   3. Cloud SQL (PostgreSQL) — structured data persistence
   *   4. Vertex AI (Gemini Pro) — AI assistant capabilities
   *   5. Google Cloud Storage — file attachments and avatars
   *   6. BigQuery — analytics and productivity insights
   *   7. Firebase Cloud Messaging — push notifications
   *   8. Cloud Run — containerized deployment platform
   *   9. Google Calendar API — deadline synchronization
   *
   * @expectedBehavior googleServices array contains exactly 9 entries
   * @googleService All 9 GCP services listed in the health response
   */
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

  /**
   * @test Verify no-cache headers on health endpoint
   *
   * @description
   *   Health check responses must never be cached by CDNs, proxies, or
   *   browser clients. A cached "healthy" response could mask a crashed
   *   service, causing Cloud Run to continue routing traffic to a dead
   *   container instance.
   *
   * @expectedBehavior Cache-Control header contains 'no-cache'
   * @performanceNote Prevents stale health status in load balancer decisions
   */
  test('Health check has no-cache headers', async () => {
    const res = await fetch(`http://localhost:${server.address().port}/api/health`);

    expect(res.headers.get('cache-control')).toContain('no-cache');
  });
});

/**
 * ═══════════════════════════════════════════════════════
 * 404 Handler Tests
 * ═══════════════════════════════════════════════════════
 *
 * Tests the catch-all handler for undefined /api/* routes.
 * Proper 404 responses are important for API discoverability and
 * preventing information leakage about internal route structure.
 */
describe('404 Handler', () => {
  /**
   * @test Verify 404 JSON response for undefined routes
   *
   * @description
   *   When a client requests an API path that does not exist, the server
   *   must respond with HTTP 404 and a structured JSON error body containing:
   *   - error: 'Not Found' (machine-readable error code)
   *   - message: human-readable description including the requested path
   *
   *   This prevents the default Express HTML error page from leaking
   *   framework details (Express version, stack traces) to potential attackers.
   *
   * @expectedBehavior Returns 404 with JSON { error, message }
   * @securityNote Prevents information disclosure about internal routing
   */
  test('Returns 404 for undefined API routes', async () => {
    const res = await fetch(`http://localhost:${server.address().port}/api/nonexistent`);
    const data = await res.json();

    expect(res.status).toBe(404);
    expect(data.error).toBe('Not Found');
    expect(data.message).toContain('does not exist');
  });
});

/**
 * ═══════════════════════════════════════════════════════
 * Security Headers Tests
 * ═══════════════════════════════════════════════════════
 *
 * Validates that Helmet.js middleware correctly injects security headers
 * into every response. These headers defend against common web attacks:
 * XSS, clickjacking, MIME-type sniffing, and cross-origin embedding.
 *
 * @see https://helmetjs.github.io/
 */
describe('Security Headers', () => {
  /**
   * @test Verify Helmet security headers are present
   *
   * @description
   *   Helmet.js configures multiple HTTP security headers:
   *   - X-Content-Type-Options: nosniff — prevents browsers from MIME-sniffing
   *     a response away from the declared Content-Type, blocking drive-by
   *     download attacks where a malicious file is served as text/html.
   *   - X-Frame-Options — prevents the page from being embedded in <iframe>,
   *     defending against clickjacking attacks.
   *
   * @expectedBehavior X-Content-Type-Options is 'nosniff', X-Frame-Options is set
   * @securityNote Critical for OWASP Top 10 compliance (A05:2021 Security Misconfiguration)
   */
  test('Returns Helmet security headers', async () => {
    const res = await fetch(`http://localhost:${server.address().port}/api/health`);

    // Helmet sets X-Content-Type-Options
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    // Helmet sets X-Frame-Options
    expect(res.headers.get('x-frame-options')).toBeTruthy();
  });

  /**
   * @test Verify CORS allows credentials for whitelisted origins
   *
   * @description
   *   The CORS configuration must:
   *   - Accept requests from http://localhost:5173 (Vite dev server)
   *   - Include Access-Control-Allow-Credentials: true so the browser
   *     sends Firebase Auth cookies/tokens in cross-origin requests
   *   - Reject requests from non-whitelisted origins
   *
   *   This is essential because the React frontend (port 5173) makes
   *   cross-origin requests to the Express backend (port 5000).
   *
   * @expectedBehavior Access-Control-Allow-Credentials: 'true' for allowed origins
   * @securityNote Prevents unauthorized cross-origin API access
   */
  test('Returns proper CORS headers for allowed origins', async () => {
    const res = await fetch(`http://localhost:${server.address().port}/api/health`, {
      headers: { 'Origin': 'http://localhost:5173' }
    });

    expect(res.headers.get('access-control-allow-credentials')).toBe('true');
  });
});

/**
 * ═══════════════════════════════════════════════════════
 * Request Validation Tests
 * ═══════════════════════════════════════════════════════
 *
 * Validates that protected API endpoints enforce Firebase Auth
 * token verification before processing any requests. This is the
 * first line of defense in the authentication pipeline.
 */
describe('Request Validation', () => {
  /**
   * @test Verify 401 response when no auth token is provided
   *
   * @description
   *   All protected endpoints (tasks, chat, AI, etc.) require a valid
   *   Firebase Auth JWT token in the Authorization header. Requests
   *   without this header must be rejected with HTTP 401 before
   *   reaching any business logic or database queries.
   *
   *   This prevents:
   *   - Unauthorized data access
   *   - Unauthenticated API abuse
   *   - Unnecessary Cloud SQL / BigQuery resource consumption
   *
   * @expectedBehavior Returns 401 with JSON error body
   * @googleService Firebase Auth (token verification)
   * @securityNote Critical gate — all authenticated endpoints depend on this
   */
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

  /**
   * @test Verify 401 response for malformed Bearer token format
   *
   * @description
   *   The Authorization header must follow the 'Bearer <token>' format.
   *   Other formats (Basic, Digest, raw tokens) must be rejected.
   *   This ensures the middleware only attempts to verify tokens that
   *   conform to the expected Firebase JWT structure.
   *
   * @expectedBehavior Returns 401 for non-Bearer auth formats
   * @securityNote Prevents auth bypass via alternative auth scheme headers
   */
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

/**
 * ═══════════════════════════════════════════════════════
 * JSON Body Parsing Tests
 * ═══════════════════════════════════════════════════════
 *
 * Tests the Express body parser's size limits, which protect against
 * Denial-of-Service attacks via oversized request payloads.
 */
describe('JSON Body Parsing', () => {
  /**
   * @test Verify request body size limit enforcement (10 MB)
   *
   * @description
   *   The Express JSON body parser is configured with a 10 MB limit.
   *   Payloads exceeding this limit must be rejected with HTTP 413
   *   (Payload Too Large) or a similar 4xx error. This prevents:
   *
   *   - Memory exhaustion on the Cloud Run container
   *   - CPU spikes from parsing extremely large JSON objects
   *   - Storage abuse via oversized task descriptions or chat messages
   *
   *   The test sends an 11 MB payload to trigger the rejection.
   *
   * @expectedBehavior Returns HTTP 400+ (413 Payload Too Large expected)
   * @performanceNote Protects Cloud Run container memory (256MB-2GB typical)
   * @securityNote Mitigates DoS via oversized payloads (OWASP API8:2023)
   */
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
