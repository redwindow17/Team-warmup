/**
 * User Routes — Cloud SQL + Firebase Auth
 */

const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/roleCheck');
const { query } = require('../config/database');

router.use(authenticate);

// Get current user profile
router.get('/me', (req, res) => {
  res.json(req.user);
});

// Update profile
router.put('/me', async (req, res) => {
  try {
    const r = await query(
      `UPDATE users SET name = COALESCE($1, name), avatar_url = COALESCE($2, avatar_url),
       fcm_token = COALESCE($3, fcm_token) WHERE id = $4 RETURNING *`,
      [req.body.name, req.body.avatarUrl, req.body.fcmToken, req.user.id]
    );
    res.json(r.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Create team
router.post('/teams', async (req, res) => {
  try {
    const r = await query(
      `INSERT INTO teams (name, description, created_by) VALUES ($1, $2, $3) RETURNING *`,
      [req.body.name, req.body.description, req.user.id]
    );
    const team = r.rows[0];
    await query(`INSERT INTO team_members (team_id, user_id, role) VALUES ($1, $2, 'admin')`, [team.id, req.user.id]);
    res.status(201).json(team);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create team' });
  }
});

// Get user's teams
router.get('/teams', async (req, res) => {
  try {
    const r = await query(
      `SELECT t.*, tm.role as member_role,
              (SELECT COUNT(*) FROM team_members WHERE team_id = t.id) as member_count
       FROM teams t JOIN team_members tm ON t.id = tm.team_id
       WHERE tm.user_id = $1 ORDER BY t.created_at DESC`,
      [req.user.id]
    );
    res.json(r.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch teams' });
  }
});

// Get team members
router.get('/teams/:teamId/members', async (req, res) => {
  try {
    const r = await query(
      `SELECT u.id, u.name, u.email, u.avatar_url, tm.role, tm.joined_at
       FROM users u JOIN team_members tm ON u.id = tm.user_id
       WHERE tm.team_id = $1 ORDER BY tm.joined_at`,
      [req.params.teamId]
    );
    res.json(r.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch members' });
  }
});

// Add team member
router.post('/teams/:teamId/members', async (req, res) => {
  try {
    const userResult = await query('SELECT id FROM users WHERE email = $1', [req.body.email]);
    if (userResult.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    await query(
      `INSERT INTO team_members (team_id, user_id, role) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
      [req.params.teamId, userResult.rows[0].id, req.body.role || 'member']
    );
    res.json({ message: 'Member added' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to add member' });
  }
});

// Update member role
router.put('/teams/:teamId/members/:userId', async (req, res) => {
  try {
    await query(
      `UPDATE team_members SET role = $1 WHERE team_id = $2 AND user_id = $3`,
      [req.body.role, req.params.teamId, req.params.userId]
    );
    res.json({ message: 'Role updated' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update role' });
  }
});

module.exports = router;
