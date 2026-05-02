/**
 * Firebase Admin SDK Configuration
 * 
 * Services: Firebase Auth, Cloud Firestore, Firebase Cloud Messaging
 * Used for: Token verification, real-time data, push notifications
 */

const admin = require('firebase-admin');

// Initialize with Application Default Credentials (ADC)
// In Cloud Run, ADC is automatic. Locally, set GOOGLE_APPLICATION_CREDENTIALS
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: process.env.FIREBASE_PROJECT_ID
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
