/**
 * Analytics Service — Google BigQuery
 * Team productivity, completion rates, bottleneck detection.
 */

const { runQuery, DATASET_ID } = require('../config/bigquery');

async function getProductivityMetrics(teamId, days = 30) {
  const sql = `
    SELECT DATE(timestamp) as date,
           COUNTIF(event_type = 'task_created') as created,
           COUNTIF(event_type = 'status_changed' AND new_status = 'done') as completed,
           COUNTIF(event_type = 'task_deleted') as deleted
    FROM \`${DATASET_ID}.task_events\`
    WHERE team_id = @teamId AND timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL @days DAY)
    GROUP BY date ORDER BY date`;
  return await runQuery(sql, { teamId, days });
}

async function getCompletionRates(teamId, days = 30) {
  const sql = `
    SELECT user_id,
           COUNTIF(event_type = 'status_changed' AND new_status = 'done') as completed,
           COUNT(DISTINCT task_id) as touched
    FROM \`${DATASET_ID}.task_events\`
    WHERE team_id = @teamId AND timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL @days DAY)
    GROUP BY user_id ORDER BY completed DESC`;
  return await runQuery(sql, { teamId, days });
}

async function getBottlenecks(teamId) {
  const sql = `
    WITH task_durations AS (
      SELECT task_id, MIN(timestamp) as started,
             MAX(IF(new_status = 'done', timestamp, NULL)) as completed
      FROM \`${DATASET_ID}.task_events\`
      WHERE team_id = @teamId
      GROUP BY task_id
    )
    SELECT task_id,
           TIMESTAMP_DIFF(COALESCE(completed, CURRENT_TIMESTAMP()), started, HOUR) as hours_in_progress,
           completed IS NULL as still_open
    FROM task_durations
    WHERE TIMESTAMP_DIFF(COALESCE(completed, CURRENT_TIMESTAMP()), started, HOUR) > 72
    ORDER BY hours_in_progress DESC LIMIT 20`;
  return await runQuery(sql, { teamId });
}

async function getMemberPerformance(teamId, userId, days = 30) {
  const sql = `
    SELECT event_type, COUNT(*) as count,
           DATE(timestamp) as date
    FROM \`${DATASET_ID}.task_events\`
    WHERE team_id = @teamId AND user_id = @userId
      AND timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL @days DAY)
    GROUP BY event_type, date ORDER BY date`;
  return await runQuery(sql, { teamId, userId, days });
}

module.exports = { getProductivityMetrics, getCompletionRates, getBottlenecks, getMemberPerformance };
