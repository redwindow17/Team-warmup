/**
 * Google Cloud SQL (PostgreSQL) Configuration
 * 
 * Service: Cloud SQL PostgreSQL
 * Used for: Structured data — tasks, users, teams, workflows
 * Supports: Direct TCP (local dev) and Unix socket (Cloud Run)
 */

const { Pool } = require('pg');

// Cloud SQL connection configuration
const poolConfig = {
  // Cloud Run uses Unix socket via Cloud SQL Auth Proxy
  ...(process.env.DB_SOCKET_PATH
    ? { host: process.env.DB_SOCKET_PATH, database: process.env.DB_NAME }
    : {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432'),
        database: process.env.DB_NAME || 'syncsphere',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || ''
      }
  ),
  max: 20,                 // Maximum pool connections
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
};

const pool = new Pool(poolConfig);

// Log connection events
pool.on('connect', () => {
  console.log('[Cloud SQL] New client connected to PostgreSQL');
});

pool.on('error', (err) => {
  console.error('[Cloud SQL] Unexpected pool error:', err.message);
});

/**
 * Execute a parameterized query
 * @param {string} text - SQL query with $1, $2... placeholders
 * @param {Array} params - Query parameters
 * @returns {Object} Query result
 */
async function query(text, params) {
  const start = Date.now();
  const result = await pool.query(text, params);
  const duration = Date.now() - start;
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[Cloud SQL] Query executed in ${duration}ms | Rows: ${result.rowCount}`);
  }
  return result;
}

/**
 * Get a client from the pool for transactions
 * @returns {Object} PostgreSQL client
 */
async function getClient() {
  const client = await pool.connect();
  return client;
}

/**
 * Execute a transaction with automatic rollback on error
 * @param {Function} callback - Async function receiving the client
 * @returns {*} Transaction result
 */
async function transaction(callback) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

module.exports = { pool, query, getClient, transaction };
