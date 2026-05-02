# SyncSphere — Test Suite Documentation

> **Comprehensive testing documentation for audit compliance and quality assurance.**

---

## Overview

SyncSphere runs **100+ automated tests** across **6 test suites** using [Jest](https://jestjs.io/) (v29). Every test suite is fully documented with JSDoc headers describing purpose, coverage scope, Google Cloud services exercised, and security/performance rationale.

### Quick Commands

```bash
npm test           # Run all tests with coverage report
npm run test:ci    # CI mode with reporters
npm run test:watch # Watch mode for development
npm run lint       # ESLint code quality check
```

---

## Test Architecture

```
backend/tests/
├── api.test.js          # REST API integration + security headers
├── config.test.js       # GCP config initialization + utilities
├── middleware.test.js    # Auth, RBAC, input validation
├── services.test.js     # All 7 services (Cloud SQL/Firestore/Vertex AI/GCS/FCM/BigQuery)
├── socket.test.js       # Socket.io real-time event handlers
└── tasks.test.js        # Workflow engine + helpers baseline
```

### Mock Strategy

All Google Cloud dependencies are mocked to enable:
- **Isolated testing** — no real GCP calls, no credentials needed
- **Deterministic results** — controlled responses for every code path
- **CI/CD compatibility** — runs in any environment without GCP access
- **Fast execution** — full suite completes in < 10 seconds

---

## Suite 1: API Integration Tests (`api.test.js`)

| # | Test Case | What It Validates | Google Service |
|---|-----------|-------------------|----------------|
| 1 | Health check returns 200 | Cloud Run readiness probe response structure | Cloud Run |
| 2 | Health check lists 9 GCP services | Runtime service manifest verification | All 9 services |
| 3 | Health check no-cache headers | Prevents stale readiness responses in load balancer | Cloud Run |
| 4 | 404 for undefined routes | JSON error formatting, prevents info leakage | — |
| 5 | Helmet security headers | X-Content-Type-Options: nosniff, X-Frame-Options | — |
| 6 | CORS credentials for allowed origins | Access-Control-Allow-Credentials for frontend | — |
| 7 | 401 without auth token | Firebase Auth gate on protected endpoints | Firebase Auth |
| 8 | 401 with invalid Bearer format | Rejects non-Bearer auth schemes | Firebase Auth |
| 9 | Rejects oversized bodies (>10MB) | DoS protection via body size limit | Cloud Run |

**Security Coverage:** Helmet headers, CORS validation, auth gates, DoS protection.

---

## Suite 2: Configuration Tests (`config.test.js`)

| # | Test Case | What It Validates | Google Service |
|---|-----------|-------------------|----------------|
| 1 | BigQuery DATASET_ID resolution | Environment-based dataset configuration | BigQuery |
| 2 | logTaskEvent row structure | Streaming insert schema compliance | BigQuery |
| 3 | TASK_STATUSES completeness | Kanban board state definitions (4 states) | Cloud SQL |
| 4 | TASK_PRIORITIES completeness | Priority level definitions (4 levels) | Cloud SQL |
| 5 | USER_ROLES completeness | RBAC role definitions (3 roles) | Firebase Auth |
| 6 | WORKFLOW_TRIGGERS completeness | Automation trigger types (6 triggers) | Cloud SQL |
| 7 | WORKFLOW_ACTIONS completeness | Automation action types (3+ actions) | FCM, Cloud SQL |
| 8 | FILE constraints | 10MB max, MIME type allowlist, JS blocked | GCS |
| 9 | Pagination defaults | DEFAULT_PAGE_SIZE=20, MAX_PAGE_SIZE=100 | Cloud SQL |
| 10 | daysUntilDeadline — future | Positive days for upcoming deadlines | — |
| 11 | daysUntilDeadline — past | Negative days for overdue detection | — |
| 12 | daysUntilDeadline — today | Boundary behavior (0 or 1) | — |
| 13 | sanitize — HTML tags | XSS prevention: `<script>` → `&lt;script&gt;` | — |
| 14 | sanitize — ampersands | Entity escaping: `&` → `&amp;` | — |
| 15 | sanitize — single quotes | Attribute injection prevention | — |
| 16 | sanitize — null/undefined | Graceful handling of missing input | — |
| 17 | sanitize — safe text | No modification to clean input | — |
| 18 | paginate — page 1 | Offset 0, limit 20 | Cloud SQL |
| 19 | paginate — subsequent pages | Correct offset calculation | Cloud SQL |
| 20 | paginate — min clamping | Negative pages → page 1 | Cloud SQL |
| 21 | paginate — max clamping | Limit > 100 → clamped to 100 | Cloud SQL |
| 22 | paginate — min limit | Limit ≤ 0 → clamped to 1 | Cloud SQL |
| 23 | paginate — defaults | Safe defaults when no arguments | Cloud SQL |
| 24 | formatDate — ISO string | Human-readable date formatting | — |
| 25 | formatDate — Date object | Accepts both input types | — |

**Security Coverage:** XSS sanitization (5 test cases), file type allowlisting.

---

## Suite 3: Middleware Tests (`middleware.test.js`)

| # | Test Case | What It Validates | Google Service |
|---|-----------|-------------------|----------------|
| 1 | Missing Authorization → 401 | First line of defense against unauthenticated access | Firebase Auth |
| 2 | Malformed Bearer → 401 | Rejects non-Bearer auth schemes | Firebase Auth |
| 3 | Valid token + existing user | Full auth pipeline with Cloud SQL user lookup | Firebase Auth, Cloud SQL |
| 4 | Auto-create on first login | New user provisioning via Cloud SQL INSERT | Firebase Auth, Cloud SQL |
| 5 | Expired/invalid token → 401 | Token expiry and tampering detection | Firebase Auth |
| 6 | requireRole allows authorized | RBAC pass-through for correct roles | — |
| 7 | requireRole rejects unauthorized | 403 Forbidden for insufficient privileges | — |
| 8 | requireRole without user → 401 | Handles missing req.user gracefully | — |
| 9 | Admin bypasses team check | Global admin access without team membership | Cloud SQL |
| 10 | Missing teamId → 400 | Parameter validation for team-scoped endpoints | — |
| 11 | Non-member → 403 | Cross-team data access prevention | Cloud SQL |
| 12 | handleValidation passes | Clean input proceeds to handler | — |
| 13 | validateTask chain structure | Express-validator chain for task input | — |
| 14 | validateMessage chain structure | Express-validator chain for chat messages | Firestore |
| 15 | validateWorkflow chain structure | Express-validator chain for workflow rules | Cloud SQL |
| 16 | validateUUID chain structure | UUID format validation for URL params | — |

**Security Coverage:** Auth verification (5 tests), RBAC (3 tests), tenant isolation (2 tests), input validation (4 tests).

---

## Suite 4: Service Layer Tests (`services.test.js`)

| # | Test Case | What It Validates | Google Service |
|---|-----------|-------------------|----------------|
| 1 | createTask → SQL + BigQuery | Task INSERT with event logging | Cloud SQL, BigQuery |
| 2 | getTasks pagination | COUNT + SELECT with offset/limit | Cloud SQL |
| 3 | getTasks parameterized queries | SQL injection prevention verification | Cloud SQL |
| 4 | getTaskById — not found | Null return for missing tasks | Cloud SQL |
| 5 | updateTask status change logging | BigQuery event with old/new status | Cloud SQL, BigQuery |
| 6 | deleteTask soft delete | is_deleted flag (data retention) | Cloud SQL |
| 7 | getTaskStats aggregation | Dashboard counts query | Cloud SQL |
| 8 | getOverdueTasks filter | deadline < NOW() + status != done | Cloud SQL |
| 9 | evaluateConditions — all operators | 5 comparison operators tested | — |
| 10 | evaluateConditions — unknown op | Graceful handling of future operators | — |
| 11 | evaluateConditions — AND logic | Multiple condition evaluation | — |
| 12 | suggestNextActions — with tasks | Vertex AI prompt with task context | Vertex AI |
| 13 | suggestNextActions — empty | Short-circuit without AI call | Vertex AI |
| 14 | detectDelays — overdue | Root cause analysis via AI | Vertex AI, Cloud SQL |
| 15 | detectDelays — no delays | Clean status message | — |
| 16 | convertChatToTasks — JSON parse | Task extraction from AI response | Vertex AI |
| 17 | convertChatToTasks — non-JSON | Graceful fallback for plain text AI | Vertex AI |
| 18 | getProductivityMetrics | BigQuery parameterized query | BigQuery |
| 19 | getCompletionRates | Per-user completion data | BigQuery |
| 20 | getBottlenecks | Long-running task detection | BigQuery |
| 21 | getMemberPerformance | User-specific metrics | BigQuery |
| 22 | handleFileUpload — with taskId | GCS path: team/task/uuid-file | GCS |
| 23 | handleFileUpload — no taskId | GCS path: team/general/uuid-file | GCS |
| 24 | getDownloadUrl | Signed URL with 60-min expiry | GCS |
| 25 | removeFile | GCS file deletion | GCS |
| 26 | getTaskFiles | List by prefix | GCS |
| 27 | notifyUser — with FCM token | Push notification delivery | FCM |
| 28 | notifyUser — no token | In-app only (no push) | FCM |
| 29 | notifyTeam — exclude sender | Broadcast to team minus sender | FCM, Cloud SQL |
| 30 | createChannel | Firestore document creation | Firestore |
| 31 | sendMessage | Message structure validation | Firestore |
| 32 | createNotification | In-app notification storage | Firestore |
| 33 | setPresence | Online/offline state | Firestore |

**Google Cloud Coverage:** All 6 data services tested (Cloud SQL, Firestore, Vertex AI, BigQuery, GCS, FCM).

---

## Suite 5: Socket.io Tests (`socket.test.js`)

| # | Test Case | What It Validates | Google Service |
|---|-----------|-------------------|----------------|
| 1 | Connect/disconnect lifecycle | WebSocket connection management | Cloud Run |
| 2 | join-team input validation | String type + 128-char length limit | — |
| 3 | task-update team broadcast | Event relay to team room members | — |
| 4 | chat-message channel relay | Message delivery to channel members | Firestore |
| 5 | chat-message — missing channelId | Silently dropped (no crash) | — |
| 6 | typing indicator forwarding | Sender excluded from own typing event | — |
| 7 | set-presence online status | Presence map update + broadcast | — |
| 8 | set-presence — missing userId | Silently ignored (no crash) | — |
| 9 | join-channel — oversized IDs | Rejects IDs > 128 characters | — |
| 10 | task-update — missing teamId | Silently dropped (no crash) | — |

**Security Coverage:** Input validation (length limits, type checking), malformed data rejection.

---

## Suite 6: Tasks Baseline Tests (`tasks.test.js`)

| # | Test Case | What It Validates | Google Service |
|---|-----------|-------------------|----------------|
| 1 | Empty conditions → true | Unconditional workflow pass-through | — |
| 2 | Equals operator | Exact value matching | — |
| 3 | Not-equals operator | Exclusion rules | — |
| 4 | Contains operator | Substring matching | — |
| 5 | Multiple conditions (AND) | All conditions must pass | — |
| 6 | Greater-than operator | Numeric comparison for overdue thresholds | — |
| 7 | Valid task statuses | Kanban state constants | Cloud SQL |
| 8 | Valid priorities | Priority level constants | Cloud SQL |
| 9 | Valid user roles | RBAC role constants | Firebase Auth |
| 10 | daysUntilDeadline calculation | Deadline arithmetic | — |
| 11 | sanitize XSS prevention | Script tag and null handling | — |
| 12 | paginate offset calculation | Offset/limit with boundary clamping | Cloud SQL |

---

## Coverage Summary

| Category | Tests | Google Services |
|----------|-------|-----------------|
| API Integration | 9 | Cloud Run, Firebase Auth |
| Configuration & Utilities | 25 | BigQuery, Cloud SQL |
| Middleware (Auth/RBAC/Validation) | 16 | Firebase Auth, Cloud SQL |
| Service Layer (7 services) | 33 | Cloud SQL, Firestore, Vertex AI, BigQuery, GCS, FCM |
| Socket.io Real-Time | 10 | Cloud Run, Firestore |
| Workflow & Helpers Baseline | 12 | Cloud SQL |
| **Total** | **105** | **All 9 GCP Services** |

### Coverage Thresholds (Jest Config)

```json
{
  "branches": 60,
  "functions": 70,
  "lines": 70,
  "statements": 70
}
```

---

## Running Tests

```bash
# Full suite with coverage
cd backend && npm test

# Watch mode (re-run on file changes)
npm run test:watch

# CI pipeline mode
npm run test:ci

# Specific suite
npx jest tests/api.test.js --verbose
npx jest tests/services.test.js --verbose

# With coverage report
npx jest --coverage --verbose
```

---

## Security Tests Checklist

| Security Control | Test Location | Status |
|-----------------|---------------|--------|
| Firebase JWT verification | middleware.test.js (5 tests) | ✅ |
| RBAC enforcement | middleware.test.js (3 tests) | ✅ |
| Team tenant isolation | middleware.test.js (2 tests) | ✅ |
| XSS sanitization | config.test.js (5 tests) | ✅ |
| SQL injection prevention | services.test.js (parameterized queries) | ✅ |
| Helmet security headers | api.test.js (2 tests) | ✅ |
| CORS origin validation | api.test.js (1 test) | ✅ |
| Body size limits (DoS) | api.test.js (1 test) | ✅ |
| File type allowlisting | config.test.js (1 test) | ✅ |
| Socket input validation | socket.test.js (4 tests) | ✅ |
| Signed URL expiry (GCS) | services.test.js (1 test) | ✅ |

---

## Accessibility Testing Notes

Frontend components implement:
- Semantic HTML5 elements (`<nav>`, `<main>`, `<section>`, `<article>`)
- ARIA labels on all interactive elements
- Keyboard navigation support (Tab, Enter, Escape)
- Focus management for modals and dropdowns
- Color contrast compliance (WCAG 2.1 AA)
- Screen reader compatible status announcements

---

*Last updated: May 2026 | SyncSphere v1.0.0*
