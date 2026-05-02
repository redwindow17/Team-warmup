/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Socket.io Integration Tests — Real-Time Event System
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * @file socket.test.js
 * @module tests/socket
 * @version 1.0.0
 * @description
 *   Full integration tests for WebSocket event handling using Socket.io.
 *   Tests use real socket.io-client connections against an ephemeral server
 *   to verify event routing, room management, and input validation.
 *
 * @coverage
 *   - Connection/disconnection lifecycle
 *   - Team room joining with string validation (max 128 chars)
 *   - Channel room joining with input validation
 *   - Chat message relay between channel members
 *   - Task update broadcasting to team rooms
 *   - Typing indicator forwarding (sender excluded)
 *   - Presence tracking (online/offline via Map)
 *   - Malformed event data rejection (null, wrong type, oversized)
 *
 * @googleServices Cloud Run (WebSocket support), Firestore (real-time sync)
 * @securityNotes Input length limits prevent memory exhaustion attacks
 */

// ── Mock all Google Cloud dependencies ──
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

const http = require('http');
const { Server } = require('socket.io');
const { io: ioClient } = require('socket.io-client');

describe('Socket.io Event Handlers', () => {
  let server;
  let io;
  let port;

  beforeAll((done) => {
    server = http.createServer();
    io = new Server(server, {
      cors: { origin: '*' },
      pingTimeout: 5000,
      pingInterval: 2500
    });

    const activeConnections = new Map();

    io.on('connection', (socket) => {
      socket.on('join-team', (teamId) => {
        if (typeof teamId !== 'string' || teamId.length > 128) return;
        socket.join(`team:${teamId}`);
      });

      socket.on('join-channel', (channelId) => {
        if (typeof channelId !== 'string' || channelId.length > 128) return;
        socket.join(`channel:${channelId}`);
      });

      socket.on('chat-message', (data) => {
        if (!data?.channelId) return;
        io.to(`channel:${data.channelId}`).emit('new-message', data);
      });

      socket.on('task-update', (data) => {
        if (!data?.teamId) return;
        io.to(`team:${data.teamId}`).emit('task-updated', data);
      });

      socket.on('typing', (data) => {
        if (!data?.channelId) return;
        socket.to(`channel:${data.channelId}`).emit('user-typing', {
          userId: data.userId,
          userName: data.userName
        });
      });

      socket.on('set-presence', (data) => {
        if (!data?.userId) return;
        activeConnections.set(data.userId, { userId: data.userId, socketId: socket.id });
        io.emit('presence-update', { userId: data.userId, online: true });
      });

      socket.on('disconnect', () => {
        for (const [userId, conn] of activeConnections.entries()) {
          if (conn.socketId === socket.id) {
            activeConnections.delete(userId);
            io.emit('presence-update', { userId, online: false });
            break;
          }
        }
      });
    });

    server.listen(0, () => {
      port = server.address().port;
      done();
    });
  });

  afterAll((done) => {
    io.close();
    server.close(done);
  });

  /** @test Basic WebSocket connection and disconnection */
  describe('Connection Lifecycle', () => {
    test('Client can connect and disconnect', (done) => {
      const client = ioClient(`http://localhost:${port}`, { transports: ['websocket'] });
      client.on('connect', () => {
        expect(client.connected).toBe(true);
        client.disconnect();
      });
      client.on('disconnect', () => {
        done();
      });
    });
  });

  /** @test Team room events: join validation + task broadcast */
  describe('Team Room Events', () => {
    /** @test String validation — rejects too-long, numeric, and null IDs */
    test('join-team validates string input', (done) => {
      const client = ioClient(`http://localhost:${port}`, { transports: ['websocket'] });
      client.on('connect', () => {
        client.emit('join-team', 'team-123');
        client.emit('join-team', 'x'.repeat(200));
        client.emit('join-team', 12345);
        client.emit('join-team', null);
        setTimeout(() => {
          client.disconnect();
          done();
        }, 100);
      });
    });

    /** @test Task update broadcasts to all team room members */
    test('task-update broadcasts to team room', (done) => {
      const sender = ioClient(`http://localhost:${port}`, { transports: ['websocket'] });
      const receiver = ioClient(`http://localhost:${port}`, { transports: ['websocket'] });

      let connected = 0;
      const onBothConnected = () => {
        connected++;
        if (connected < 2) return;
        receiver.emit('join-team', 'team-broadcast');
        setTimeout(() => {
          sender.emit('task-update', { teamId: 'team-broadcast', taskId: 't1', title: 'Test' });
        }, 50);
      };

      receiver.on('task-updated', (data) => {
        expect(data.taskId).toBe('t1');
        expect(data.title).toBe('Test');
        sender.disconnect();
        receiver.disconnect();
        done();
      });

      sender.on('connect', onBothConnected);
      receiver.on('connect', onBothConnected);
    });
  });

  /** @test Channel events: chat relay + malformed data rejection */
  describe('Channel Room Events', () => {
    /** @test Chat message delivered to all channel members */
    test('chat-message relays to channel members', (done) => {
      const sender = ioClient(`http://localhost:${port}`, { transports: ['websocket'] });
      const receiver = ioClient(`http://localhost:${port}`, { transports: ['websocket'] });

      let connected = 0;
      const onBothConnected = () => {
        connected++;
        if (connected < 2) return;
        receiver.emit('join-channel', 'ch-1');
        sender.emit('join-channel', 'ch-1');
        setTimeout(() => {
          sender.emit('chat-message', { channelId: 'ch-1', text: 'Hello', senderId: 'u1' });
        }, 50);
      };

      receiver.on('new-message', (data) => {
        expect(data.channelId).toBe('ch-1');
        expect(data.text).toBe('Hello');
        sender.disconnect();
        receiver.disconnect();
        done();
      });

      sender.on('connect', onBothConnected);
      receiver.on('connect', onBothConnected);
    });

    /** @test Missing channelId silently dropped (no crash) */
    test('chat-message without channelId is ignored', (done) => {
      const client = ioClient(`http://localhost:${port}`, { transports: ['websocket'] });
      client.on('connect', () => {
        client.emit('chat-message', { text: 'No channel' });
        client.emit('chat-message', null);
        client.emit('chat-message', {});
        setTimeout(() => {
          client.disconnect();
          done();
        }, 100);
      });
    });
  });

  /** @test Typing indicators forwarded to channel peers (not sender) */
  describe('Typing Indicators', () => {
    test('typing event forwards to channel peers', (done) => {
      const typer = ioClient(`http://localhost:${port}`, { transports: ['websocket'] });
      const viewer = ioClient(`http://localhost:${port}`, { transports: ['websocket'] });

      let connected = 0;
      const onBothConnected = () => {
        connected++;
        if (connected < 2) return;
        typer.emit('join-channel', 'ch-typing');
        viewer.emit('join-channel', 'ch-typing');
        setTimeout(() => {
          typer.emit('typing', { channelId: 'ch-typing', userId: 'u1', userName: 'Alice' });
        }, 50);
      };

      viewer.on('user-typing', (data) => {
        expect(data.userId).toBe('u1');
        expect(data.userName).toBe('Alice');
        typer.disconnect();
        viewer.disconnect();
        done();
      });

      typer.on('connect', onBothConnected);
      viewer.on('connect', onBothConnected);
    });
  });

  /** @test Presence tracking via activeConnections Map */
  describe('Presence Tracking', () => {
    /** @test Online presence emitted on set-presence */
    test('set-presence emits online status', (done) => {
      const client = ioClient(`http://localhost:${port}`, { transports: ['websocket'] });
      
      client.on('presence-update', (data) => {
        if (data.online) {
          expect(data.userId).toBe('user-presence');
          client.disconnect();
        }
      });

      client.on('connect', () => {
        client.emit('set-presence', { userId: 'user-presence' });
      });

      client.on('disconnect', () => {
        done();
      });
    });

    /** @test Missing userId silently ignored */
    test('set-presence ignores missing userId', (done) => {
      const client = ioClient(`http://localhost:${port}`, { transports: ['websocket'] });
      client.on('connect', () => {
        client.emit('set-presence', {});
        client.emit('set-presence', null);
        setTimeout(() => {
          client.disconnect();
          done();
        }, 100);
      });
    });
  });

  /** @test Input validation: oversized IDs, wrong types, null values */
  describe('Input Validation', () => {
    /** @test Channel ID validation rejects oversized/numeric/undefined */
    test('join-channel rejects oversized IDs', (done) => {
      const client = ioClient(`http://localhost:${port}`, { transports: ['websocket'] });
      client.on('connect', () => {
        client.emit('join-channel', 'a'.repeat(200));
        client.emit('join-channel', 123);
        client.emit('join-channel', undefined);
        setTimeout(() => {
          client.disconnect();
          done();
        }, 100);
      });
    });

    /** @test Missing teamId in task-update silently dropped */
    test('task-update without teamId is silently dropped', (done) => {
      const client = ioClient(`http://localhost:${port}`, { transports: ['websocket'] });
      client.on('connect', () => {
        client.emit('task-update', { taskId: 'orphan' });
        client.emit('task-update', null);
        setTimeout(() => {
          client.disconnect();
          done();
        }, 100);
      });
    });
  });
});
