/**
 * Firebase Admin SDK Configuration
 * 
 * Services: Firebase Auth, Cloud Firestore, Firebase Cloud Messaging
 * Used for: Token verification, real-time data, push notifications
 */

const admin = require('firebase-admin');

const fs = require('fs');
const path = require('path');

const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || './serviceAccountKey.json';
const absoluteKeyPath = path.resolve(keyPath);

if (!admin.apps.length) {
  let credentialConfig;
  
  // Explicitly use the GCP Key file if it exists
  if (fs.existsSync(absoluteKeyPath)) {
    console.log('[Firebase] Using explicit GCP Service Account Key:', absoluteKeyPath);
    credentialConfig = admin.credential.cert(require(absoluteKeyPath));
  } else {
    console.log('[Firebase] Falling back to Application Default Credentials');
    credentialConfig = admin.credential.applicationDefault();
  }

  admin.initializeApp({
    credential: credentialConfig,
    projectId: process.env.FIREBASE_PROJECT_ID || 'redwindow-482406'
  });
}

const db = admin.firestore();
const auth = admin.auth();
const messaging = admin.messaging();

/**
 * Send push notification via Firebase Cloud Messaging
 * @param {string} token - FCM device token
 * @param {string} title - Notification title
 * @param {string} body - Notification body
 * @param {Object} data - Additional data payload
 */
async function sendPushNotification(token, title, body, data = {}) {
  try {
    const message = {
      notification: { title, body },
      data: { ...data, timestamp: new Date().toISOString() },
      token
    };
    const response = await messaging.send(message);
    console.log('[FCM] Notification sent:', response);
    return response;
  } catch (error) {
    console.error('[FCM] Send error:', error.message);
    throw error;
  }
}

/**
 * Verify Firebase ID token from client
 * @param {string} idToken - Firebase ID token
 * @returns {Object} Decoded token with user info
 */
async function verifyToken(idToken) {
  try {
    const decodedToken = await auth.verifyIdToken(idToken);
    return decodedToken;
  } catch (error) {
    console.error('[Auth] Token verification failed:', error.message);
    throw error;
  }
}

module.exports = {
  admin,
  db,
  auth,
  messaging,
  sendPushNotification,
  verifyToken
};
