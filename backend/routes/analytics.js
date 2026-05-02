/**
 * Analytics Routes — Google BigQuery
 */

const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const analyticsService = require('../services/analyticsService');

router.use(authenticate);

router.get('/productivity/:teamId', async (req, res) => {
  try {
    const data = await analyticsService.getProductivityMetrics(req.params.teamId, parseInt(req.query.days) || 30);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch productivity data' });
  }
});

router.get('/completion/:teamId', async (req, res) => {
  try {
    const data = await analyticsService.getCompletionRates(req.params.teamId, parseInt(req.query.days) || 30);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch completion rates' });
  }
});

router.get('/bottlenecks/:teamId', async (req, res) => {
  try {
    const data = await analyticsService.getBottlenecks(req.params.teamId);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to detect bottlenecks' });
  }
});

router.get('/member/:teamId/:userId', async (req, res) => {
  try {
    const data = await analyticsService.getMemberPerformance(req.params.teamId, req.params.userId, parseInt(req.query.days) || 30);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch member performance' });
  }
});

module.exports = router;
