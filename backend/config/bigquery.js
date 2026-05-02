/**
 * Google BigQuery Configuration
 * 
 * Service: Google BigQuery
 * Used for: Analytics, productivity insights, bottleneck detection
 * Dataset: syncsphere_analytics
 */

const { BigQuery } = require('@google-cloud/bigquery');

const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || './serviceAccountKey.json';

const bigquery = new BigQuery({
  projectId: process.env.GOOGLE_PROJECT_ID || 'redwindow-482406',
  keyFilename: require('fs').existsSync(keyPath) ? keyPath : undefined
});
const DATASET_ID = process.env.BQ_DATASET || 'syncsphere_analytics';

/**
 * Execute a BigQuery SQL query
 * @param {string} sql - SQL query
 * @param {Object} params - Named query parameters
 * @returns {Array} Query results
 */
async function runQuery(sql, params = {}) {
  try {
    const options = {
      query: sql,
      params,
      location: 'US'
    };
    const [rows] = await bigquery.query(options);
    return rows;
  } catch (error) {
    console.error('[BigQuery] Query error:', error.message);
    throw error;
  }
}

/**
 * Insert rows into a BigQuery table
 * @param {string} tableId - Table name
 * @param {Array} rows - Array of row objects
 */
async function insertRows(tableId, rows) {
  try {
    const dataset = bigquery.dataset(DATASET_ID);
    const table = dataset.table(tableId);
    await table.insert(rows);
    console.log(`[BigQuery] Inserted ${rows.length} rows into ${tableId}`);
  } catch (error) {
    // BigQuery insert errors contain partial failure info
    if (error.name === 'PartialFailureError') {
      console.error('[BigQuery] Partial insert failure:', error.errors.length, 'rows failed');
    } else {
      console.error('[BigQuery] Insert error:', error.message);
    }
    throw error;
  }
}

/**
 * Log a task event to BigQuery for analytics
 * @param {Object} event - Event data
 */
async function logTaskEvent(event) {
  const row = {
    event_id: event.eventId || require('uuid').v4(),
    event_type: event.type,
    task_id: event.taskId,
    user_id: event.userId,
    team_id: event.teamId,
    old_status: event.oldStatus || null,
    new_status: event.newStatus || null,
    priority: event.priority || null,
    timestamp: BigQuery.timestamp(new Date())
  };

  try {
    await insertRows('task_events', [row]);
  } catch (error) {
    // Don't fail the main operation if analytics logging fails
    console.warn('[BigQuery] Failed to log task event (non-blocking):', error.message);
  }
}

/**
 * Log user activity to BigQuery
 * @param {Object} activity - Activity data
 */
async function logUserActivity(activity) {
  const row = {
    activity_id: require('uuid').v4(),
    user_id: activity.userId,
    team_id: activity.teamId,
    action_type: activity.actionType,
    details: JSON.stringify(activity.details || {}),
    timestamp: BigQuery.timestamp(new Date())
  };

  try {
    await insertRows('user_activity', [row]);
  } catch (error) {
    console.warn('[BigQuery] Failed to log activity (non-blocking):', error.message);
  }
}

/**
 * Initialize BigQuery dataset and tables if they don't exist
 */
async function initializeAnalytics() {
  try {
    const dataset = bigquery.dataset(DATASET_ID);
    const [exists] = await dataset.exists();

    if (!exists) {
      await bigquery.createDataset(DATASET_ID, { location: 'US' });
      console.log(`[BigQuery] Created dataset: ${DATASET_ID}`);
    }

    // Create task_events table
    const taskEventsSchema = [
      { name: 'event_id', type: 'STRING', mode: 'REQUIRED' },
      { name: 'event_type', type: 'STRING', mode: 'REQUIRED' },
      { name: 'task_id', type: 'STRING' },
      { name: 'user_id', type: 'STRING' },
      { name: 'team_id', type: 'STRING' },
      { name: 'old_status', type: 'STRING' },
      { name: 'new_status', type: 'STRING' },
      { name: 'priority', type: 'STRING' },
      { name: 'timestamp', type: 'TIMESTAMP', mode: 'REQUIRED' }
    ];

    // Create user_activity table
    const userActivitySchema = [
      { name: 'activity_id', type: 'STRING', mode: 'REQUIRED' },
      { name: 'user_id', type: 'STRING', mode: 'REQUIRED' },
      { name: 'team_id', type: 'STRING' },
      { name: 'action_type', type: 'STRING', mode: 'REQUIRED' },
      { name: 'details', type: 'STRING' },
      { name: 'timestamp', type: 'TIMESTAMP', mode: 'REQUIRED' }
    ];

    const tables = [
      { id: 'task_events', schema: taskEventsSchema },
      { id: 'user_activity', schema: userActivitySchema }
    ];

    for (const tableDef of tables) {
      const table = dataset.table(tableDef.id);
      const [tableExists] = await table.exists();
      if (!tableExists) {
        await dataset.createTable(tableDef.id, { schema: tableDef.schema });
        console.log(`[BigQuery] Created table: ${tableDef.id}`);
      }
    }

    console.log('[BigQuery] Analytics initialized successfully');
  } catch (error) {
    console.warn('[BigQuery] Init warning (non-blocking):', error.message);
  }
}

module.exports = {
  bigquery,
  runQuery,
  insertRows,
  logTaskEvent,
  logUserActivity,
  initializeAnalytics,
  DATASET_ID
};
