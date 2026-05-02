# SyncSphere — AI-Powered Team Coordination Platform

> **Smart collaboration system combining Slack + Trello + Notion, enhanced with Google Cloud AI and automation.**

Built for startups, remote teams, college project teams, and small enterprises.

![Node.js](https://img.shields.io/badge/Node.js-20+-339933?logo=node.js)
![React](https://img.shields.io/badge/React-18+-61DAFB?logo=react)
![Google Cloud](https://img.shields.io/badge/Google%20Cloud-9%20Services-4285F4?logo=googlecloud)
![Tests](https://img.shields.io/badge/Tests-105%2B%20passing-brightgreen?logo=jest)
![Coverage](https://img.shields.io/badge/Coverage-70%25%2B-green)
![License](https://img.shields.io/badge/License-MIT-blue)

---

> **📖 For a complete deep-dive into how we utilize Google Cloud services, please read our [Full Documentation](./DOCUMENTATION.md).**
>
> **🧪 For detailed test case documentation, see our [Test Documentation](./TEST_DOCUMENTATION.md).**

## Features

### Smart Task Management
- Create, assign, and track tasks with Kanban board
- Task priority (urgent/high/medium/low), deadlines, and status tracking
- AI-based task suggestions based on team activity (Vertex AI)
- Auto-group tasks into workflows

### Real-Time Collaboration
- Channel-based team chat + direct messaging (Cloud Firestore)
- Activity feed with live updates
- WebSocket real-time sync (Socket.io)

### AI Assistant (Core Differentiator)
- **Powered by Google Vertex AI (Gemini 1.5 Pro)**
- Suggest next actions based on incomplete tasks
- Detect delays and recommend solutions
- Summarize daily work updates
- Convert chat messages into actionable tasks
- Conversation memory per user

### Workflow Automation
- Rule-based triggers (task delayed → notify manager)
- Smart deadline reminders
- Status auto-update actions
- Scheduled deadline checks (every 30 minutes)

### Dashboard & Analytics
- Team productivity insights (**Google BigQuery**)
- Task completion graphs (Chart.js)
- Bottleneck detection
- Member performance tracking

### Role-Based Access Control
- Admin / Manager / Member roles
- Team-scoped permissions
- Firebase Auth security

---

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│                FRONTEND (React + Vite + Bootstrap 5)      │
│   Dashboard │ Tasks │ Chat │ Analytics │ Workflows        │
│                      │                                    │
│          Firebase Client SDK (Auth + Firestore)           │
└──────────────────────┼────────────────────────────────────┘
                       │  REST API + WebSocket
┌──────────────────────┼────────────────────────────────────┐
│           BACKEND (Node.js + Express) on Cloud Run        │
│   Task API │ Chat API │ AI API │ Workflow Engine           │
│                      │                                    │
│   Firebase Admin + Cloud SQL + GCS + BigQuery + Vertex AI │
└──────────────────────┼────────────────────────────────────┘
                       │
┌──────────────────────┼────────────────────────────────────┐
│              GOOGLE CLOUD PLATFORM (9 Services)           │
│                                                           │
│  Firebase Auth    │ Cloud Firestore │ Cloud SQL (PG)      │
│  Vertex AI Gemini │ Cloud Storage   │ BigQuery            │
│  Firebase FCM     │ Cloud Run       │ Google Calendar     │
└───────────────────────────────────────────────────────────┘
```

---

## ☁️ Google Cloud Services Used

| # | Service | Purpose |
|---|---------|---------|
| 1 | **Firebase Authentication** | User login/signup (Email + Google OAuth) |
| 2 | **Cloud Firestore** | Real-time chat, presence, notifications |
| 3 | **Cloud SQL (PostgreSQL)** | Structured data: tasks, users, teams, workflows |
| 4 | **Vertex AI (Gemini 1.5 Pro)** | AI assistant, task suggestions, summarization |
| 5 | **Google Cloud Storage (GCS)** | File attachments, exports, avatars |
| 6 | **BigQuery** | Analytics engine, productivity insights |
| 7 | **Firebase Cloud Messaging (FCM)** | Push notifications |
| 8 | **Cloud Run** | Containerized backend deployment |
| 9 | **Google Calendar API** | Deadline sync (optional) |

> **Google Cloud is the backbone** — every feature integrates with at least one Google service.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite, Bootstrap 5, Chart.js, Socket.io Client |
| Backend | Node.js 20, Express 4, Socket.io |
| Database | Cloud SQL (PostgreSQL), Cloud Firestore |
| AI | Vertex AI (Gemini 1.5 Pro) |
| Storage | Google Cloud Storage |
| Analytics | Google BigQuery |
| Auth | Firebase Authentication |
| Notifications | Firebase Cloud Messaging |
| Deployment | Cloud Run, Cloud Build |
| Testing | Jest 29, Supertest, Socket.io Client |
| Linting | ESLint 8 |

---

## Project Structure

```
Team-warmup/
├── README.md                   # Project overview (this file)
├── DOCUMENTATION.md            # Google Cloud integration deep-dive
├── TEST_DOCUMENTATION.md       # Test suite documentation (105+ tests)
├── package.json                # Root scripts (dev, test, lint, setup)
├── Dockerfile                  # Cloud Run multi-stage build
├── cloudbuild.yaml             # CI/CD pipeline
│
├── backend/
│   ├── server.js               # Express + Socket.io entry
│   ├── .eslintrc.json          # ESLint configuration
│   ├── config/
│   │   ├── firebase.js         # Firebase Admin SDK
│   │   ├── database.js         # Cloud SQL PostgreSQL pool
│   │   ├── vertexai.js         # Vertex AI Gemini Pro
│   │   ├── storage.js          # Google Cloud Storage
│   │   └── bigquery.js         # BigQuery analytics
│   ├── middleware/
│   │   ├── auth.js             # Firebase token verification
│   │   ├── roleCheck.js        # Role-based access control
│   │   └── validate.js         # Input validation (express-validator)
│   ├── routes/
│   │   ├── tasks.js            # Task CRUD (Cloud SQL)
│   │   ├── chat.js             # Chat (Firestore)
│   │   ├── ai.js               # AI endpoints (Vertex AI)
│   │   ├── workflows.js        # Automation rules
│   │   ├── analytics.js        # Analytics (BigQuery)
│   │   ├── users.js            # User/team management
│   │   └── files.js            # File upload (GCS)
│   ├── services/
│   │   ├── taskService.js      # Cloud SQL queries
│   │   ├── chatService.js      # Firestore operations
│   │   ├── aiService.js        # Vertex AI integration
│   │   ├── workflowEngine.js   # Rule engine
│   │   ├── analyticsService.js # BigQuery queries
│   │   ├── storageService.js   # GCS operations
│   │   └── notificationService.js # FCM push
│   ├── models/
│   │   └── schema.sql          # PostgreSQL schema
│   ├── utils/
│   │   ├── helpers.js          # Date, sanitize, paginate utilities
│   │   └── constants.js        # Shared enumerations
│   └── tests/                  # ← 6 test suites, 105+ test cases
│       ├── api.test.js         # API integration + health check + security
│       ├── config.test.js      # BigQuery, SQL, constants, helpers (25 tests)
│       ├── middleware.test.js   # Auth, RBAC, validation (16 tests)
│       ├── services.test.js    # All 7 services (33 tests)
│       ├── socket.test.js      # Socket.io real-time events (10 tests)
│       └── tasks.test.js       # Workflow engine + helpers (12 tests)
│
└── frontend/
    ├── index.html
    ├── vite.config.js
    └── src/
        ├── App.jsx             # Root + routing
        ├── main.jsx            # Entry point
        ├── index.css           # Design system
        ├── App.css             # Layout styles
        ├── config/firebase.js  # Firebase client
        ├── contexts/           # Auth + Theme
        ├── components/         # UI components
        │   ├── layout/         # Sidebar, TopBar
        │   ├── ai/             # AI Assistant
        │   └── common/         # Shared components
        ├── pages/              # Dashboard, Tasks, Chat,
        │                       # Analytics, Workflows, Settings
        └── services/           # API layer
```

---

## Setup Instructions

### Prerequisites
- Node.js 20+
- Google Cloud account with project created
- Firebase project configured

### 1. Clone & Install

```bash
git clone <repo-url>
cd Team-warmup
npm run setup   # Installs backend + frontend dependencies
```

### 2. Firebase Setup

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Create a new project or select existing
3. Enable **Authentication** (Email/Password + Google Sign-In)
4. Enable **Cloud Firestore** (start in test mode)
5. Enable **Cloud Messaging**
6. Go to Project Settings > Service Accounts > Generate new private key
7. Save as `backend/serviceAccountKey.json`

### 3. Google Cloud Setup

```bash
# Enable required APIs
gcloud services enable sqladmin.googleapis.com
gcloud services enable aiplatform.googleapis.com
gcloud services enable bigquery.googleapis.com
gcloud services enable storage.googleapis.com
gcloud services enable run.googleapis.com

# Create Cloud SQL instance
gcloud sql instances create syncsphere-db \
  --database-version=POSTGRES_15 \
  --tier=db-f1-micro \
  --region=us-central1

# Create database
gcloud sql databases create syncsphere --instance=syncsphere-db

# Create GCS bucket
gsutil mb gs://syncsphere-files
```

### 4. Initialize Database

```bash
# Apply schema to Cloud SQL
psql -h <CLOUD_SQL_IP> -U postgres -d syncsphere -f backend/models/schema.sql
```

### 5. Environment Variables

```bash
# Backend
cp backend/.env.example backend/.env
# Edit backend/.env with your credentials

# Frontend
cp frontend/.env.example frontend/.env
# Edit frontend/.env with Firebase config
```

### 6. Run Development

```bash
npm run dev   # Starts both backend (5000) and frontend (5173)
```

### 7. Deploy to Cloud Run

```bash
gcloud builds submit --config=cloudbuild.yaml
```

---

## API Endpoints

| Method | Endpoint | Description | Google Service |
|--------|----------|-------------|----------------|
| POST | `/api/tasks` | Create task | Cloud SQL |
| GET | `/api/tasks/team/:id` | List tasks | Cloud SQL |
| PUT | `/api/tasks/:id` | Update task | Cloud SQL + BigQuery |
| POST | `/api/ai/suggest` | AI suggestions | Vertex AI |
| POST | `/api/ai/summarize` | Daily summary | Vertex AI |
| POST | `/api/ai/chat` | AI chat | Vertex AI + Firestore |
| POST | `/api/chat/messages` | Send message | Firestore |
| GET | `/api/analytics/productivity/:id` | Productivity | BigQuery |
| POST | `/api/files/upload` | Upload file | Cloud Storage |
| GET | `/api/health` | Health check | Cloud Run |

---

## Security

- **Firebase Auth** token verification on every request
- **Role-based access control** (admin/manager/member)
- **Input validation** with express-validator
- **Rate limiting** — 200 req/15min (standard), 30 req/15min (AI endpoints)
- **Helmet.js** security headers (CSP, HSTS, X-Frame-Options, etc.)
- **Parameterized SQL queries** (no SQL injection)
- **Signed URLs** for file access (time-limited, Google Cloud Storage)
- **CORS origin whitelist** with configurable `ALLOWED_ORIGINS` env var
- **Request correlation IDs** for Cloud Logging traceability
- **Body size limits** (10MB max) to prevent DoS
- **XSS sanitization** on all user-generated content
- **File type allowlisting** (blocks JavaScript uploads)

## Performance & Efficiency

- **Gzip/deflate compression** via `compression` middleware (60-80% bandwidth reduction)
- **ETag caching** for conditional GET requests
- **Connection pooling** via `pg` Pool with configurable limits
- **Static asset caching** — 1-year Cache-Control for hashed Vite bundles
- **Slow request detection** — warns for requests > 1000ms
- **Cloud Run auto-scaling** with graceful shutdown (SIGTERM/SIGINT handling)
- **Pagination clamping** — MAX_PAGE_SIZE prevents unbounded queries

## Accessibility

- **Semantic HTML5** elements (`<nav>`, `<main>`, `<section>`, `<article>`)
- **ARIA labels** on all interactive elements (buttons, inputs, modals)
- **Keyboard navigation** — Tab, Enter, Escape support throughout UI
- **Focus management** — modals and dropdowns trap and restore focus
- **Color contrast** — WCAG 2.1 AA compliant color palette
- **Screen reader** compatible status announcements via `aria-live`
- **Skip navigation** links for main content access
- **Responsive design** — fully usable on mobile, tablet, and desktop

## Testing

Runs **105+ tests** across **6 fully-documented test suites** with Jest 29:

```bash
npm test           # Run all tests with coverage
npm run test:ci    # CI mode with reporters
npm run lint       # ESLint code quality check
```

| Test Suite | Tests | Coverage Scope | Google Services |
|------------|-------|----------------|-----------------|
| `api.test.js` | 9 | Health check, 404, security headers, auth, DoS | Cloud Run, Firebase Auth |
| `config.test.js` | 25 | BigQuery config, SQL pool, constants, helpers, sanitize | BigQuery, Cloud SQL |
| `middleware.test.js` | 16 | Firebase auth, RBAC roles, team isolation, input validation | Firebase Auth, Cloud SQL |
| `services.test.js` | 33 | Task, Chat, AI, Workflow, Analytics, Storage, Notification | All 6 data services |
| `socket.test.js` | 10 | WebSocket connection, rooms, chat relay, presence, validation | Cloud Run, Firestore |
| `tasks.test.js` | 12 | Workflow engine conditions, constants, helpers baseline | Cloud SQL |

**Coverage Thresholds:** Branches 60% | Functions 70% | Lines 70% | Statements 70%

> 📝 **Full test documentation with per-test case tables:** [TEST_DOCUMENTATION.md](./TEST_DOCUMENTATION.md)

### Security Test Matrix

| Security Control | Verified By |
|-----------------|-------------|
| Firebase JWT verification | `middleware.test.js` (5 tests) |
| RBAC enforcement | `middleware.test.js` (3 tests) |
| Team tenant isolation | `middleware.test.js` (2 tests) |
| XSS sanitization | `config.test.js` (5 tests) |
| SQL injection prevention | `services.test.js` (parameterized queries) |
| Helmet security headers | `api.test.js` (2 tests) |
| CORS origin validation | `api.test.js` (1 test) |
| Body size limits | `api.test.js` (1 test) |
| File type allowlisting | `config.test.js` (1 test) |
| Socket input validation | `socket.test.js` (4 tests) |

---

## Future Improvements

- [ ] Google Calendar API deep integration (deadline sync)
- [ ] Video conferencing (Google Meet API)
- [ ] Advanced workflow builder with visual drag-and-drop editor
- [ ] Mobile app (React Native + Firebase)
- [ ] Slack/Teams integration via webhooks
- [ ] Custom AI model fine-tuning on team data (Vertex AI Custom Training)
- [ ] Advanced RBAC with custom permissions and audit trails
- [ ] Cloud Logging structured audit logging
- [ ] Multi-language support (i18n / Cloud Translation API)
- [ ] Offline mode with service workers (PWA)
- [ ] Real-time collaborative document editing
- [ ] Advanced BigQuery ML for predictive deadline analysis

---

## License

MIT License — Built with Google Cloud Platform
