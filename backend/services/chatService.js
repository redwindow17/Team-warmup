/**
 * Chat Service — Cloud Firestore Real-Time Operations
 * 
 * Service: Google Cloud Firestore
 * Used for: Real-time chat channels, messages, and presence
 */

const { db } = require('../config/firebase');
const { v4: uuidv4 } = require('uuid');

/**
 * Create a new chat channel
 */
async function createChannel(channelData) {
  const channelId = uuidv4();
  const channel = {
    id: channelId,
    name: channelData.name,
    type: channelData.type || 'channel', // 'channel' or 'dm'
    teamId: channelData.teamId,
    members: channelData.members || [],
    createdBy: channelData.createdBy,
    createdAt: new Date().toISOString(),
    lastMessage: null,
    lastMessageAt: null
  };

  await db.collection('channels').doc(channelId).set(channel);
  console.log(`[Firestore] Channel created: ${channelData.name}`);
  return channel;
}

/**
 * Get channels for a team
 */
async function getChannels(teamId, userId) {
  const snapshot = await db.collection('channels')
    .where('teamId', '==', teamId)
    .orderBy('lastMessageAt', 'desc')
    .get();

  const channels = [];
  snapshot.forEach(doc => {
    const data = doc.data();
    // For DMs, only show if user is a member
    if (data.type === 'dm' && !data.members.includes(userId)) return;
    channels.push({ id: doc.id, ...data });
  });

  return channels;
}

/**
 * Send a message to a channel
 */
async function sendMessage(messageData) {
  const messageId = uuidv4();
  const message = {
    id: messageId,
    text: messageData.text,
    senderId: messageData.senderId,
    senderName: messageData.senderName,
    senderAvatar: messageData.senderAvatar || null,
    channelId: messageData.channelId,
    attachments: messageData.attachments || [],
    reactions: {},
    isPinned: false,
    isTaskConversion: false,
    timestamp: new Date().toISOString()
  };

  // Add message to channel subcollection
  await db.collection('channels')
    .doc(messageData.channelId)
    .collection('messages')
    .doc(messageId)
    .set(message);

  // Update channel's last message
  await db.collection('channels')
    .doc(messageData.channelId)
    .update({
      lastMessage: messageData.text.substring(0, 100),
      lastMessageAt: message.timestamp
    });

  return message;
}

/**
 * Get messages for a channel (paginated)
 */
async function getMessages(channelId, limit = 50, beforeTimestamp = null) {
  let messagesQuery = db.collection('channels')
    .doc(channelId)
    .collection('messages')
    .orderBy('timestamp', 'desc')
    .limit(limit);

  if (beforeTimestamp) {
    messagesQuery = messagesQuery.where('timestamp', '<', beforeTimestamp);
  }

  const snapshot = await messagesQuery.get();
  const messages = [];
  snapshot.forEach(doc => {
    messages.push({ id: doc.id, ...doc.data() });
  });

  return messages.reverse(); // Return in chronological order
}

/**
 * Add reaction to a message
 */
async function addReaction(channelId, messageId, userId, emoji) {
  const messageRef = db.collection('channels')
    .doc(channelId)
    .collection('messages')
    .doc(messageId);

  await db.runTransaction(async (t) => {
    const doc = await t.get(messageRef);
    if (!doc.exists) throw new Error('Message not found');

    const reactions = doc.data().reactions || {};
    if (!reactions[emoji]) reactions[emoji] = [];

    if (!reactions[emoji].includes(userId)) {
      reactions[emoji].push(userId);
    }

    t.update(messageRef, { reactions });
  });
}

/**
 * Pin/unpin a message
 */
async function togglePin(channelId, messageId) {
  const messageRef = db.collection('channels')
    .doc(channelId)
    .collection('messages')
    .doc(messageId);

  const doc = await messageRef.get();
  if (!doc.exists) throw new Error('Message not found');

  await messageRef.update({ isPinned: !doc.data().isPinned });
  return { isPinned: !doc.data().isPinned };
}

/**
 * Update user presence
 */
async function setPresence(userId, online) {
  await db.collection('presence').doc(userId).set({
    online,
    lastSeen: new Date().toISOString()
  }, { merge: true });
}

/**
 * Store in-app notification
 */
async function createNotification(userId, notification) {
  const notifId = uuidv4();
  await db.collection('notifications')
    .doc(userId)
    .collection('items')
    .doc(notifId)
    .set({
      id: notifId,
      title: notification.title,
      body: notification.body,
      type: notification.type || 'info',
      link: notification.link || null,
      read: false,
      timestamp: new Date().toISOString()
    });
  return notifId;
}

module.exports = {
  createChannel,
  getChannels,
  sendMessage,
  getMessages,
  addReaction,
  togglePin,
  setPresence,
  createNotification
};
