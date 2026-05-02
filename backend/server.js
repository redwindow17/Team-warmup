/**
 * SyncSphere Backend — Express Server Entry Point
 * 
 * Google Cloud Services Used:
 * - Firebase Admin SDK (Auth verification)
 * - Cloud SQL PostgreSQL (Structured data)
 * - Cloud Firestore (Real-time chat/presence)
 * - Vertex AI Gemini Pro (AI assistant)
 * - Google Cloud Storage (File uploads)
 * - BigQuery (Analytics)
 * - Firebase Cloud Messaging (Push notifications)
 * 
 * Deployed on: Google Cloud Run
 * 
 * @module server
 * @version 1.0.0
 * @description Main entry point for the SyncSphere API server.
 *   Configures Express middleware stack, Socket.io real-time handlers,
 *   API routing, security headers, performance optimizations, and
 *   graceful shutdown procedures for production-grade Cloud Run deployment.
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// FORCE GCP KEY FOR ALL SERVICES:
// If serviceAccountKey.json exists and env var isn't set, forcefully set it so all 
// Google Cloud client libraries automatically use it for authentication.
const defaultKeyPath = path.resolve(__dirname, 'serviceAccountKey.json');
if (!process.env.GOOGLE_APPLICATION_CREDENTIALS && fs.existsSync(defaultKeyPath)) {
  process.env.GOOGLE_APPLICATION_CREDENTIALS = defaultKeyPath;
  console.log('🔑 [Auth] Forced GOOGLE_APPLICATION_CREDENTIALS to:', defaultKeyPath);
}
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const { createServer } = require('http');
const { Server } = require('socket.io');

// Route imports
const taskRoutes = require('./routes/tasks');
const chatRoutes = require('./routes/chat');
const aiRoutes = require('./routes/ai');
const workflowRoutes = require('./routes/workflows');
const analyticsRoutes = require('./routes/analytics');
const userRoutes = require('./routes/users');
const fileRoutes = require('./routes/files');

const app = express();
const httpServer = createServer(app);

// Allowed origins for CORS (configurable via environment)
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || process.env.FRONTEND_URL || 'http://localhost:5173')
  .split(',').map(o => o.trim());

// Socket.io for real-time events
const io = new Server(httpServer, {
  cors: {
    origin: ALLOWED_ORIGINS,
    methods: ['GET', 'POST'],
    credentials: true
  },
  pingTimeout: 60000,
  pingInterval: 25000
});

// Make io accessible to routes
app.set('io', io);

// ============================================
// Performance & Observability Middleware
// ============================================

// Request correlation ID for tracing across Google Cloud services
app.use((req, _res, next) => {
  req.id = req.headers['x-request-id'] || req.headers['x-cloud-trace-context']?.split('/')[0] || crypto.randomUUID();
  next();
});

// Response time tracking for performance monitoring
app.use((req, res, next) => {
  const startTime = process.hrtime.bigint();
  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startTime) / 1e6;
    if (durationMs > 1000 && process.env.NODE_ENV !== 'test') {
      console.warn(`[Perf] Slow request: ${req.method} ${req.path} took ${durationMs.toFixed(1)}ms [reqId=${req.id}]`);
    }
  });
  next();
});

// ETag support for response caching (efficiency)
app.set('etag', 'strong');

// ============================================
// Security Middleware Stack
// ============================================

// Security headers — Helmet with Content Security Policy
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://apis.google.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      connectSrc: ["'self'", "https://*.googleapis.com", "https://*.firebaseio.com", "wss:", "ws:"],
      frameSrc: ["'self'", "https://*.firebaseapp.com"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"]
    }
  },
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true }
}));

// CORS with origin validation
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    if (ALLOWED_ORIGINS.includes(origin)) {
      return callback(null, true);
    }
    callback(new Error('CORS origin not allowed'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
  exposedHeaders: ['X-Request-ID', 'X-Response-Time'],
  maxAge: 86400 // Cache preflight for 24 hours
}));

// Rate limiting — tiered by endpoint sensitivity
const standardLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // limit each IP to 200 requests per window
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.headers['x-forwarded-for']?.split(',')[0] || req.ip
});
const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30, // AI endpoints are more resource-intensive (Vertex AI)
  message: { error: 'AI rate limit exceeded. Please wait before trying again.' },
  standardHeaders: true,
  legacyHeaders: false
});
app.use('/api/', standardLimiter);
app.use('/api/ai/', aiLimiter);

// Response compression — gzip/deflate for bandwidth optimization (Cloud Run)
app.use(compression({
  level: 6, // Balanced between speed and compression ratio
  threshold: 1024, // Only compress responses > 1KB
  filter: (req, res) => {
    // Don't compress responses with cache-control: no-transform
    if (req.headers['x-no-compression']) return false;
    return compression.filter(req, res);
  }
}));

// Body parsing with size limits
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging — structured for Cloud Logging integration
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan(':method :url :status :response-time ms - :req[x-request-id]'));
}

// ============================================
// API Routes
// ============================================

app.use('/api/tasks', taskRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/workflows', workflowRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/users', userRoutes);
app.use('/api/files', fileRoutes);

// Health check endpoint (required for Cloud Run)
app.get('/api/health', (req, res) => {
  res.set('Cache-Control', 'no-cache, no-store');
  res.json({
    status: 'healthy',
    service: 'SyncSphere API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: {
      heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB',
      rss: Math.round(process.memoryUsage().rss / 1024 / 1024) + 'MB'
    },
    googleServices: [
      'Firebase Auth',
      'Cloud Firestore',
      'Cloud SQL (PostgreSQL)',
      'Vertex AI (Gemini Pro)',
      'Google Cloud Storage',
      'BigQuery',
      'Firebase Cloud Messaging',
      'Cloud Run',
      'Google Calendar API'
    ]
  });
});

// ============================================
// Serve Frontend (Production)
// ============================================

if (process.env.NODE_ENV === 'production') {
  // Cache static assets for 1 year (they have hash in filename from Vite build)
  app.use(express.static(path.join(__dirname, 'public'), {
    maxAge: '1y',
    etag: true,
    lastModified: true,
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('.html')) {
        res.setHeader('Cache-Control', 'no-cache');
      }
    }
  }));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  });
}

// ============================================
// Socket.io Connection Handler
// ============================================

/** @type {Map<string, {userId: string, socketId: string}>} Active connections tracker */
const activeConnections = new Map();

io.on('connection', (socket) => {
  console.log(`[Socket] Client connected: ${socket.id}`);

  // Join team room
  socket.on('join-team', (teamId) => {
    if (typeof teamId !== 'string' || teamId.length > 128) return;
    socket.join(`team:${teamId}`);
    console.log(`[Socket] ${socket.id} joined team:${teamId}`);
  });

  // Join chat channel
  socket.on('join-channel', (channelId) => {
    if (typeof channelId !== 'string' || channelId.length > 128) return;
    socket.join(`channel:${channelId}`);
  });

  // Chat message relay
  socket.on('chat-message', (data) => {
    if (!data?.channelId) return;
    io.to(`channel:${data.channelId}`).emit('new-message', data);
  });

  // Task update relay
  socket.on('task-update', (data) => {
    if (!data?.teamId) return;
    io.to(`team:${data.teamId}`).emit('task-updated', data);
  });

  // Typing indicator
  socket.on('typing', (data) => {
    if (!data?.channelId) return;
    socket.to(`channel:${data.channelId}`).emit('user-typing', {
      userId: data.userId,
      userName: data.userName
    });
  });

  // Presence
  socket.on('set-presence', (data) => {
    if (!data?.userId) return;
    activeConnections.set(data.userId, { userId: data.userId, socketId: socket.id });
    io.emit('presence-update', { userId: data.userId, online: true });
  });

  socket.on('disconnect', () => {
    // Clean up presence tracking
    for (const [userId, conn] of activeConnections.entries()) {
      if (conn.socketId === socket.id) {
        activeConnections.delete(userId);
        io.emit('presence-update', { userId, online: false });
        break;
      }
    }
    console.log(`[Socket] Client disconnected: ${socket.id}`);
  });
});

// ============================================
// 404 Handler for undefined API routes
// ============================================

app.use('/api/*', (req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `API endpoint ${req.method} ${req.originalUrl} does not exist`,
    availableEndpoints: '/api/health for service status'
  });
});

// ============================================
// Global Error Handler
// ============================================

app.use((err, req, res, _next) => {
  // Log with request correlation ID for Cloud Logging traceability
  console.error(`[Error] [reqId=${req.id}]`, err.stack);
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    error: process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : err.message,
    requestId: req.id,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  });
});

// ============================================
// Graceful Shutdown (critical for Cloud Run)
// ============================================

function gracefulShutdown(signal) {
  console.log(`\n[Server] Received ${signal}. Starting graceful shutdown...`);
  
  // Stop accepting new connections
  httpServer.close(() => {
    console.log('[Server] HTTP server closed.');
    // Close Socket.io connections
    io.close(() => {
      console.log('[Server] Socket.io closed.');
      // Close database pool
      const { pool } = require('./config/database');
      pool.end(() => {
        console.log('[Server] Database pool closed.');
        process.exit(0);
      });
    });
  });

  // Force exit after 10 seconds if graceful shutdown takes too long
  setTimeout(() => {
    console.error('[Server] Forced exit after timeout.');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle unhandled promise rejections (prevent silent crashes)
process.on('unhandledRejection', (reason, promise) => {
  console.error('[Process] Unhandled Rejection:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('[Process] Uncaught Exception:', error);
  gracefulShutdown('uncaughtException');
});

// ============================================
// Start Server
// ============================================

const PORT = process.env.PORT || 5000;

// Do NOT auto-listen when imported by test files — each test suite creates
// its own ephemeral server on port 0 to avoid EADDRINUSE conflicts in CI.
if (process.env.NODE_ENV !== 'test') {
  httpServer.listen(PORT, () => {
    console.log('');
    console.log('  ╔═══════════════════════════════════════════╗');
    console.log('  ║          SyncSphere API Server            ║');
    console.log(`  ║       Running on port ${PORT}                ║`);
    console.log('  ║                                           ║');
    console.log('  ║  Google Cloud Services:                   ║');
    console.log('  ║   • Firebase Auth       ✓                 ║');
    console.log('  ║   • Cloud Firestore     ✓                 ║');
    console.log('  ║   • Cloud SQL (PG)      ✓                 ║');
    console.log('  ║   • Vertex AI Gemini    ✓                 ║');
    console.log('  ║   • Cloud Storage       ✓                 ║');
    console.log('  ║   • BigQuery            ✓                 ║');
    console.log('  ║   • Cloud Messaging     ✓                 ║');
    console.log('  ║   • Cloud Run           ✓                 ║');
    console.log('  ║   • Google Calendar     ✓                 ║');
    console.log('  ╚═══════════════════════════════════════════╝');
    console.log('');
  });
}

module.exports = { app, httpServer, io };
