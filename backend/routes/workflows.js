/**
 * Workflow Routes — Automation Rules
 */

const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/roleCheck');
const { validateWorkflow } = require('../middleware/validate');
const { query } = require('../config/database');

router.use(authenticate);

// Create workflow
router.post('/', validateWorkflow, async (req, res) => {
  try {
    const r = await query(
      `INSERT INTO workflows (name, description, team_id, trigger_type, conditions, actions, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [req.body.name, req.body.description, req.body.teamId, req.body.triggerType,
       JSON.stringify(req.body.conditions || []), JSON.stringify(req.body.actions || []), req.user.id]
    );
    res.status(201).json(r.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create workflow' });
  }
});

// List workflows for team
router.get('/team/:teamId', async (req, res) => {
  try {
    const r = await query(
      `SELECT w.*, u.name as creator_name FROM workflows w
       LEFT JOIN users u ON w.created_by = u.id
       WHERE w.team_id = $1 ORDER BY w.created_at DESC`,
      [req.params.teamId]
    );
    res.json(r.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch workflows' });
  }
});

// Update workflow
router.put('/:id', async (req, res) => {
  try {
    const fields = [];
    const vals = [];
    let i = 1;
    for (const [k, v] of Object.entries(req.body)) {
      if (['name','description','trigger_type','conditions','actions','enabled'].includes(k)) {
        fields.push(`${k} = $${i}`);
        vals.push(k === 'conditions' || k === 'actions' ? JSON.stringify(v) : v);
        i++;
      }
    }
    if (fields.length === 0) return res.status(400).json({ error: 'No fields to update' });
    vals.push(req.params.id);
    const r = await query(`UPDATE workflows SET ${fields.join(', ')} WHERE id = $${i} RETURNING *`, vals);
    if (r.rows.length === 0) return res.status(404).json({ error: 'Workflow not found' });
    res.json(r.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update workflow' });
  }
});

// Delete workflow
router.delete('/:id', async (req, res) => {
  try {
    const r = await query('DELETE FROM workflows WHERE id = $1 RETURNING id', [req.params.id]);
    if (r.rows.length === 0) return res.status(404).json({ error: 'Workflow not found' });
    res.json({ message: 'Workflow deleted', id: req.params.id });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete workflow' });
  }
});

module.exports = router;
