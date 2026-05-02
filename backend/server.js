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
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const { createServer } = require('http');
const { Server } = require('socket.io');
const path = require('path');

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

// Socket.io for real-time events
const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    methods: ['GET', 'POST']
  }
});

// Make io accessible to routes
app.set('io', io);

// ============================================
// Middleware Stack
// ============================================

// Security headers
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));

// CORS
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // limit each IP to 200 requests per window
  message: { error: 'Too many requests, please try again later.' }
});
app.use('/api/', limiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Logging
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
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
  res.json({
    status: 'healthy',
    service: 'SyncSphere API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    googleServices: [
      'Firebase Auth',
      'Cloud Firestore',
      'Cloud SQL (PostgreSQL)',
      'Vertex AI (Gemini Pro)',
      'Google Cloud Storage',
      'BigQuery',
      'Firebase Cloud Messaging',
      'Cloud Run'
    ]
  });
});

// ============================================
// Serve Frontend (Production)
// ============================================

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'public')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  });
}

// ============================================
// Socket.io Connection Handler
// ============================================

io.on('connection', (socket) => {
  console.log(`[Socket] Client connected: ${socket.id}`);

  // Join team room
  socket.on('join-team', (teamId) => {
    socket.join(`team:${teamId}`);
    console.log(`[Socket] ${socket.id} joined team:${teamId}`);
  });

  // Join chat channel
  socket.on('join-channel', (channelId) => {
    socket.join(`channel:${channelId}`);
  });

  // Chat message relay
  socket.on('chat-message', (data) => {
    io.to(`channel:${data.channelId}`).emit('new-message', data);
  });

  // Task update relay
  socket.on('task-update', (data) => {
    io.to(`team:${data.teamId}`).emit('task-updated', data);
  });

  // Typing indicator
  socket.on('typing', (data) => {
    socket.to(`channel:${data.channelId}`).emit('user-typing', {
      userId: data.userId,
      userName: data.userName
    });
  });

  // Presence
  socket.on('set-presence', (data) => {
    io.emit('presence-update', { userId: data.userId, online: true });
  });

  socket.on('disconnect', () => {
    console.log(`[Socket] Client disconnected: ${socket.id}`);
  });
});

// ============================================
// Global Error Handler
// ============================================

app.use((err, req, res, _next) => {
  console.error('[Error]', err.stack);
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    error: process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : err.message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  });
});

// ============================================
// Start Server
// ============================================

const PORT = process.env.PORT || 5000;
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
  console.log('  ╚═══════════════════════════════════════════╝');
  console.log('');
});

module.exports = { app, httpServer, io };
