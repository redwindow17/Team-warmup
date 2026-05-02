/**
 * Auth Middleware — Firebase Token Verification
 * 
 * Verifies Firebase ID tokens from the Authorization header.
 * Attaches decoded user info to req.user.
 */

const { verifyToken } = require('../config/firebase');
const { query } = require('../config/database');

/**
 * Authenticate requests using Firebase ID tokens
 * Expects: Authorization: Bearer <firebase-id-token>
 */
async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'Missing or invalid Authorization header. Use: Bearer <token>'
      });
    }

    const idToken = authHeader.split('Bearer ')[1];
    const decodedToken = await verifyToken(idToken);

    // Get user from Cloud SQL
    const result = await query(
      'SELECT id, firebase_uid, name, email, role, avatar_url FROM users WHERE firebase_uid = $1',
      [decodedToken.uid]
    );

    if (result.rows.length === 0) {
      // Auto-create user on first login
      const newUser = await query(
        `INSERT INTO users (firebase_uid, name, email, avatar_url)
         VALUES ($1, $2, $3, $4)
         RETURNING id, firebase_uid, name, email, role, avatar_url`,
        [
          decodedToken.uid,
          decodedToken.name || decodedToken.email?.split('@')[0] || 'User',
          decodedToken.email || '',
          decodedToken.picture || null
        ]
      );
      req.user = newUser.rows[0];
    } else {
      req.user = result.rows[0];
    }

    next();
  } catch (error) {
    console.error('[Auth Middleware] Error:', error.message);
    return res.status(401).json({
      error: 'Authentication failed',
      message: 'Invalid or expired token'
    });
  }
}

module.exports = { authenticate };
