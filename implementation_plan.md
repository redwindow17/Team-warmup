# SyncSphere — AI-Powered Team Coordination Platform

Build a smart collaboration system (Slack + Trello + Notion hybrid) with intelligent automation powered by **Google Cloud Platform** services.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                    FRONTEND (React + Vite + Bootstrap 5)            │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌─────────┐ │
│  │Dashboard │ │  Tasks   │ │   Chat   │ │Analytics │ │Settings │ │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬────┘ │
│       └─────────────┴─────────────┴─────────────┴──────────┘      │
│                         │                                          │
│    ┌────────────────────┴────────────────────┐                     │
│    │  Firebase Client SDK (Auth + Firestore) │                     │
│    └────────────────────┬────────────────────┘                     │
└─────────────────────────┼─────────────────────────────────────────┘
                          │  REST API + WebSocket
┌─────────────────────────┼─────────────────────────────────────────┐
│              BACKEND (Node.js + Express) — Cloud Run               │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐             │
│  │ Task API │ │ Chat API │ │  AI API  │ │Workflow  │             │
│  │          │ │          │ │(Vertex)  │ │ Engine   │             │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘             │
│       │             │            │             │                   │
│  ┌────┴─────────────┴────────────┴─────────────┴──────────┐       │
│  │              Service Layer                              │       │
│  │  Firebase Admin + Cloud SQL + GCS + BigQuery + Vertex   │       │
│  └─────────────────────────┬──────────────────────────────┘       │
└─────────────────────────────┼─────────────────────────────────────┘
                              │
┌─────────────────────────────┼─────────────────────────────────────┐
│                  GOOGLE CLOUD PLATFORM SERVICES                    │
│                                                                    │
│  ┌────────────────┐  ┌─────────────────┐  ┌────────────────────┐  │
│  │ Firebase Auth  │  │ Cloud Firestore │  │ Firebase Cloud     │  │
│  │ (Login/Signup) │  │ (Real-time sync │  │ Messaging (Push)   │  │
│  │                │  │  chat, presence) │  │                    │  │
│  └────────────────┘  └─────────────────┘  └────────────────────┘  │
│                                                                    │
│  ┌────────────────┐  ┌─────────────────┐  ┌────────────────────┐  │
│  │ Vertex AI      │  │ Google Cloud    │  │ Google Cloud SQL   │  │
│  │ (Gemini Pro)   │  │ Storage (GCS)   │  │ (PostgreSQL)       │  │
│  │ AI Assistant,  │  │ File uploads,   │  │ Tasks, Users,      │  │
│  │ Suggestions,   │  │ Attachments,    │  │ Workflows,         │  │
│  │ Summarization  │  │ Exports         │  │ Teams, Roles       │  │
│  └────────────────┘  └─────────────────┘  └────────────────────┘  │
│                                                                    │
│  ┌────────────────┐  ┌─────────────────┐  ┌────────────────────┐  │
│  │ BigQuery       │  │ Cloud Run       │  │ Google Calendar    │  │
│  │ Analytics,     │  │ Backend hosting │  │ API (Deadline      │  │
│  │ Productivity   │  │ Auto-scaling    │  │ sync, optional)    │  │
│  │ Insights       │  │ Containerized   │  │                    │  │
│  └────────────────┘  └─────────────────┘  └────────────────────┘  │
└───────────────────────────────────────────────────────────────────┘
```

### Database Strategy (Dual-Database)

| Data Type | Store | Reason |
|-----------|-------|--------|
| Chat messages, presence, notifications | **Cloud Firestore** | Real-time sync, low latency |
| Tasks, users, teams, workflows, roles | **Cloud SQL (PostgreSQL)** | Relational queries, JOINs, reporting |
| Analytics events, productivity logs | **BigQuery** | Large-scale analytics, complex aggregations |
| File attachments, exports | **Google Cloud Storage** | Scalable blob storage |

---

## Google Cloud Services Used (7 Services)

| # | Service | Purpose |
|---|---------|---------|
| 1 | **Firebase Authentication** | User login/signup (Email, Google OAuth) |
| 2 | **Cloud Firestore** | Real-time chat, presence, notifications |
| 3 | **Cloud SQL (PostgreSQL)** | Structured data: tasks, users, teams, workflows |
| 4 | **Vertex AI (Gemini Pro)** | AI assistant, task suggestions, summarization, delay detection |
| 5 | **Google Cloud Storage** | File attachments, report exports, avatars |
| 6 | **BigQuery** | Analytics engine, productivity insights, bottleneck detection |
| 7 | **Firebase Cloud Messaging** | Push notifications |
| 8 | **Cloud Run** | Backend deployment (containerized, auto-scaling) |
| 9 | **Google Calendar API** | Deadline sync (optional) |

---

## Proposed Changes

### Phase 1: Project Scaffolding & Configuration

#### [NEW] Folder Structure

```
f:\FUN\Promtwar\Team-warmup\
├── README.md
├── package.json
├── Dockerfile                      # Cloud Run deployment
├── .dockerignore
├── cloudbuild.yaml                 # Cloud Build CI/CD
│
├── backend/
│   ├── package.json
│   ├── .env.example
│   ├── server.js                   # Express entry point + Socket.io
│   ├── config/
│   │   ├── firebase.js             # Firebase Admin SDK
│   │   ├── database.js             # Cloud SQL (pg) connection pool
│   │   ├── vertexai.js             # Vertex AI client init
│   │   ├── storage.js              # Google Cloud Storage client
│   │   └── bigquery.js             # BigQuery client
│   ├── models/
│   │   ├── schema.sql              # PostgreSQL schema
│   │   ├── User.js                 # User model (Cloud SQL)
│   │   ├── Task.js                 # Task model (Cloud SQL)
│   │   ├── Team.js                 # Team model (Cloud SQL)
│   │   └── Workflow.js             # Workflow model (Cloud SQL)
│   ├── middleware/
│   │   ├── auth.js                 # Firebase token verification
│   │   ├── validate.js             # Input validation (express-validator)
│   │   └── roleCheck.js            # Role-based access control
│   ├── routes/
│   │   ├── tasks.js
│   │   ├── chat.js
│   │   ├── ai.js
│   │   ├── workflows.js
│   │   ├── analytics.js
│   │   ├── users.js
│   │   └── files.js                # GCS file upload/download
│   ├── services/
│   │   ├── taskService.js          # Cloud SQL queries
│   │   ├── chatService.js          # Firestore real-time
│   │   ├── aiService.js            # Vertex AI Gemini integration
│   │   ├── workflowEngine.js       # Automation rules engine
│   │   ├── notificationService.js  # FCM push notifications
│   │   ├── analyticsService.js     # BigQuery analytics
│   │   └── storageService.js       # GCS file operations
│   ├── utils/
│   │   ├── helpers.js
│   │   └── constants.js
│   └── tests/
│       ├── tasks.test.js
│       └── workflows.test.js
│
├── frontend/
│   ├── package.json
│   ├── vite.config.js
│   ├── index.html
│   ├── .env.example
│   ├── public/
│   │   └── favicon.svg
│   └── src/
│       ├── main.jsx
│       ├── App.jsx
│       ├── App.css
│       ├── index.css
│       ├── config/
│       │   └── firebase.js
│       ├── contexts/
│       │   ├── AuthContext.jsx
│       │   └── ThemeContext.jsx
│       ├── hooks/
│       │   ├── useAuth.js
│       │   ├── useTasks.js
│       │   ├── useChat.js
│       │   └── useFirestore.js
│       ├── components/
│       │   ├── layout/
│       │   │   ├── Sidebar.jsx
│       │   │   ├── TopBar.jsx
│       │   │   └── MainLayout.jsx
│       │   ├── auth/
│       │   │   ├── LoginForm.jsx
│       │   │   └── SignupForm.jsx
│       │   ├── tasks/
│       │   │   ├── TaskBoard.jsx
│       │   │   ├── TaskCard.jsx
│       │   │   ├── TaskForm.jsx
│       │   │   └── TaskFilters.jsx
│       │   ├── chat/
│       │   │   ├── ChatPanel.jsx
│       │   │   ├── ChannelList.jsx
│       │   │   ├── MessageBubble.jsx
│       │   │   └── DirectMessage.jsx
│       │   ├── ai/
│       │   │   ├── AiAssistant.jsx
│       │   │   └── AiSuggestionCard.jsx
│       │   ├── dashboard/
│       │   │   ├── StatsCards.jsx
│       │   │   ├── ProductivityChart.jsx
│       │   │   ├── ActivityFeed.jsx
│       │   │   └── BottleneckAlert.jsx
│       │   ├── workflows/
│       │   │   ├── WorkflowBuilder.jsx
│       │   │   └── RuleCard.jsx
│       │   └── common/
│       │       ├── LoadingSpinner.jsx
│       │       ├── Avatar.jsx
│       │       ├── FileUpload.jsx
│       │       └── Toast.jsx
│       ├── pages/
│       │   ├── Dashboard.jsx
│       │   ├── Tasks.jsx
│       │   ├── Chat.jsx
│       │   ├── Analytics.jsx
│       │   ├── Workflows.jsx
│       │   ├── Settings.jsx
│       │   ├── Login.jsx
│       │   └── Signup.jsx
│       ├── services/
│       │   ├── api.js
│       │   ├── taskApi.js
│       │   ├── chatApi.js
│       │   └── aiApi.js
│       └── utils/
│           ├── formatters.js
│           └── constants.js
```

---

### Phase 2: Backend — Google Cloud Integration Layer

#### [NEW] [config/database.js](file:///f:/FUN/Promtwar/Team-warmup/backend/config/database.js)
- Cloud SQL PostgreSQL connection pool via `pg` library
- Connection string from env vars (supports Cloud SQL Auth Proxy)
- Query helper functions with parameterized queries

#### [NEW] [config/vertexai.js](file:///f:/FUN/Promtwar/Team-warmup/backend/config/vertexai.js)
- `@google-cloud/vertexai` SDK initialization
- Gemini Pro model configuration
- System instructions for SyncSphere AI persona
- Token limits and safety settings

#### [NEW] [config/storage.js](file:///f:/FUN/Promtwar/Team-warmup/backend/config/storage.js)
- `@google-cloud/storage` client initialization
- Bucket configuration for file uploads
- Signed URL generation for secure downloads

#### [NEW] [config/bigquery.js](file:///f:/FUN/Promtwar/Team-warmup/backend/config/bigquery.js)
- `@google-cloud/bigquery` client initialization
- Dataset and table references
- Query helper for analytics

#### [NEW] [models/schema.sql](file:///f:/FUN/Promtwar/Team-warmup/backend/models/schema.sql)
PostgreSQL schema for Cloud SQL:
```sql
-- users, teams, team_members, tasks, task_assignments,
-- workflows, workflow_rules, activities, ai_conversations
```

#### [NEW] [services/aiService.js](file:///f:/FUN/Promtwar/Team-warmup/backend/services/aiService.js)
- **Vertex AI Gemini Pro** integration
- Context-aware prompts with team/project context
- Conversation memory stored in Firestore (per user)
- Functions:
  - `suggestNextActions(teamId, userId)` — Analyze incomplete tasks, suggest priorities
  - `detectDelays(teamId)` — Scan overdue tasks, recommend solutions
  - `summarizeDailyWork(teamId, date)` — Generate daily standup summary
  - `convertChatToTasks(messages)` — Extract actionable items from chat
  - `chat(userId, message)` — General AI assistant conversation

#### [NEW] [services/analyticsService.js](file:///f:/FUN/Promtwar/Team-warmup/backend/services/analyticsService.js)
- **BigQuery** integration for analytics
- Event ingestion: task created/completed/delayed, user activity
- Queries:
  - Team productivity over time
  - Task completion rates by member
  - Bottleneck detection (tasks stuck > X days)
  - Average time-to-completion by priority

#### [NEW] [services/storageService.js](file:///f:/FUN/Promtwar/Team-warmup/backend/services/storageService.js)
- **Google Cloud Storage** file operations
- Upload with metadata (team, task, uploader)
- Generate signed download URLs (time-limited)
- Delete attachments
- List files by task/team

#### [NEW] [routes/files.js](file:///f:/FUN/Promtwar/Team-warmup/backend/routes/files.js)
- `POST /api/files/upload` — Upload file to GCS (multer middleware)
- `GET /api/files/:fileId/download` — Get signed download URL
- `DELETE /api/files/:fileId` — Delete file from GCS
- `GET /api/files/task/:taskId` — List files for a task

---

### Phase 3: Backend — Core APIs

#### [NEW] [routes/tasks.js](file:///f:/FUN/Promtwar/Team-warmup/backend/routes/tasks.js)
- Full CRUD via **Cloud SQL** queries
- `POST /api/tasks` — Create task (insert into PostgreSQL)
- `GET /api/tasks` — List with filters, pagination, sorting
- `PUT /api/tasks/:id` — Update status/priority/assignee
- `DELETE /api/tasks/:id` — Soft delete
- `POST /api/tasks/:id/assign` — Assign to member
- `GET /api/tasks/suggestions` — AI suggestions via **Vertex AI**
- Events streamed to **BigQuery** for analytics

#### [NEW] [routes/chat.js](file:///f:/FUN/Promtwar/Team-warmup/backend/routes/chat.js)
- Channel management via **Firestore** (real-time)
- Messages stored in Firestore subcollections
- Socket.io broadcast for instant delivery
- Convert-to-task action via **Vertex AI**

#### [NEW] [routes/ai.js](file:///f:/FUN/Promtwar/Team-warmup/backend/routes/ai.js)
- All AI endpoints powered by **Vertex AI Gemini Pro**
- `POST /api/ai/suggest` — Smart next-action suggestions
- `POST /api/ai/summarize` — Daily work summary
- `POST /api/ai/chat-to-tasks` — Extract tasks from chat
- `POST /api/ai/detect-delays` — Delay analysis
- `POST /api/ai/chat` — General assistant with memory

#### [NEW] [routes/analytics.js](file:///f:/FUN/Promtwar/Team-warmup/backend/routes/analytics.js)
- All analytics powered by **BigQuery**
- `GET /api/analytics/productivity` — Team productivity metrics
- `GET /api/analytics/completion` — Completion rates over time
- `GET /api/analytics/bottlenecks` — Stuck task detection
- `GET /api/analytics/member/:id` — Individual performance

#### [NEW] [services/workflowEngine.js](file:///f:/FUN/Promtwar/Team-warmup/backend/services/workflowEngine.js)
- Rule engine with conditions and actions
- Triggers: task_delayed, status_changed, deadline_approaching, task_created
- Actions: send_notification (FCM), auto_assign, update_status, send_email
- Scheduled checks via setInterval (runs on Cloud Run instance)

---

### Phase 4: Frontend — UI Components & Pages

#### [NEW] [index.css](file:///f:/FUN/Promtwar/Team-warmup/frontend/src/index.css)
- Premium design system with CSS custom properties
- Dark/light theme tokens
- Glassmorphism cards, gradient headers
- Bootstrap 5 overrides for modern look
- Micro-animations (fade, slide, pulse)
- Google Fonts (Inter)

#### [NEW] [pages/Dashboard.jsx](file:///f:/FUN/Promtwar/Team-warmup/frontend/src/pages/Dashboard.jsx)
- Animated stats cards with gradient backgrounds
- Productivity chart (Chart.js) — data from **BigQuery** via API
- Activity feed — real-time from **Firestore**
- AI suggestion cards — powered by **Vertex AI**
- File attachment indicators from **GCS**

#### [NEW] [pages/Tasks.jsx](file:///f:/FUN/Promtwar/Team-warmup/frontend/src/pages/Tasks.jsx)
- Kanban board (To Do / In Progress / Review / Done)
- Drag & drop with react-beautiful-dnd
- Task data from **Cloud SQL** via REST API
- File attachments upload to **GCS**
- AI task grouping via **Vertex AI**

#### [NEW] [pages/Chat.jsx](file:///f:/FUN/Promtwar/Team-warmup/frontend/src/pages/Chat.jsx)
- Real-time messaging via **Firestore** onSnapshot
- Channel-based + direct messaging
- File sharing via **GCS** signed URLs
- "Convert to task" → creates in **Cloud SQL**

#### [NEW] [pages/Analytics.jsx](file:///f:/FUN/Promtwar/Team-warmup/frontend/src/pages/Analytics.jsx)
- Charts powered by **BigQuery** analytics data
- Task completion trends, team productivity bars
- Bottleneck detection with visual alerts
- Export reports to **GCS**

#### [NEW] [components/ai/AiAssistant.jsx](file:///f:/FUN/Promtwar/Team-warmup/frontend/src/components/ai/AiAssistant.jsx)
- Floating assistant panel (slide-out)
- Chat with **Vertex AI Gemini Pro**
- Context-aware: knows your tasks, team, deadlines
- Quick actions: Create Task, Summarize Day, Find Blockers

---

### Phase 5: Cloud Run Deployment Config

#### [NEW] [Dockerfile](file:///f:/FUN/Promtwar/Team-warmup/Dockerfile)
- Multi-stage build (frontend build → backend serve)
- Node.js 20 Alpine base
- Optimized for **Cloud Run** (PORT env, health check)

#### [NEW] [cloudbuild.yaml](file:///f:/FUN/Promtwar/Team-warmup/cloudbuild.yaml)
- **Cloud Build** CI/CD pipeline
- Build Docker image → Push to Container Registry → Deploy to **Cloud Run**
- Connect to **Cloud SQL** via Unix socket

---

### Phase 6: Testing & Documentation

#### [NEW] [tests/tasks.test.js](file:///f:/FUN/Promtwar/Team-warmup/backend/tests/tasks.test.js)
- Unit tests for task CRUD (mocked Cloud SQL)
- Validation tests
- Role-based access tests

#### [NEW] [tests/workflows.test.js](file:///f:/FUN/Promtwar/Team-warmup/backend/tests/workflows.test.js)
- Workflow trigger evaluation tests
- Action execution tests

#### [NEW] [README.md](file:///f:/FUN/Promtwar/Team-warmup/README.md)
- Project overview with all 9 Google Cloud services highlighted
- Architecture diagram (ASCII)
- Setup: Firebase project, Cloud SQL instance, GCS bucket, BigQuery dataset, Vertex AI enable
- Environment variables guide
- Cloud Run deployment instructions
- Future improvements

---

## Database Schemas

### Cloud SQL (PostgreSQL)

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firebase_uid VARCHAR(128) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  avatar_url TEXT,
  role VARCHAR(20) DEFAULT 'member',  -- admin, manager, member
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE team_members (
  team_id UUID REFERENCES teams(id),
  user_id UUID REFERENCES users(id),
  role VARCHAR(20) DEFAULT 'member',
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (team_id, user_id)
);

CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(500) NOT NULL,
  description TEXT,
  status VARCHAR(20) DEFAULT 'todo',     -- todo, in_progress, review, done
  priority VARCHAR(10) DEFAULT 'medium', -- low, medium, high, urgent
  assignee_id UUID REFERENCES users(id),
  team_id UUID REFERENCES teams(id),
  created_by UUID REFERENCES users(id),
  deadline TIMESTAMPTZ,
  tags TEXT[],
  workflow_group VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  team_id UUID REFERENCES teams(id),
  trigger_type VARCHAR(50) NOT NULL,
  conditions JSONB DEFAULT '[]',
  actions JSONB DEFAULT '[]',
  enabled BOOLEAN DEFAULT true,
  last_run TIMESTAMPTZ,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Firestore Collections (Real-time Data)

```
channels/{channelId}
  name, type, teamId, members[], createdAt
  └── messages/{messageId}
        text, senderId, senderName, timestamp, attachments[]

notifications/{userId}/items/{notificationId}
  title, body, read, type, link, timestamp

presence/{userId}
  online, lastSeen

aiConversations/{userId}
  messages[], lastUpdated
```

### BigQuery Tables

```
syncsphere.analytics.task_events
  event_id, event_type, task_id, user_id, team_id,
  old_status, new_status, timestamp

syncsphere.analytics.user_activity
  activity_id, user_id, team_id, action_type,
  details, timestamp
```

---

## Verification Plan

### Automated Tests
- `cd backend && npm test` — Jest unit tests for task CRUD, workflow engine
- Validate input sanitization and auth middleware

### Manual Verification
- Run `npm run dev` for both frontend and backend
- Test login/signup with Firebase Auth
- Create/assign/complete tasks → verify Cloud SQL persistence
- Upload files → verify GCS storage and signed URLs
- Send chat messages → verify Firestore real-time sync
- Open AI assistant → verify Vertex AI Gemini responses
- Check analytics dashboard → verify BigQuery data flow
- Test workflow triggers → verify FCM notifications
- Mobile responsiveness at 375px, 768px, 1024px
- Role-based access: admin vs manager vs member

### Cloud Run Deployment Test
- `docker build` and `docker run` locally
- Verify Cloud SQL connection via Auth Proxy
- Verify GCS, BigQuery, Vertex AI connectivity

---

## Estimated Size
- **~55 files** total
- **Frontend**: ~35 files (~200KB)
- **Backend**: ~20 files (~80KB)
- **Total**: Well under 10MB constraint
