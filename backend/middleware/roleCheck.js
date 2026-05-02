/**
 * Role Check Middleware — Role-Based Access Control
 * 
 * Checks user role from Cloud SQL against required roles.
 * Must be used AFTER authenticate middleware.
 */

/**
 * Create middleware that requires specific roles
 * @param  {...string} allowedRoles - Roles that can access the route
 * @returns {Function} Express middleware
 * 
 * Usage: router.post('/admin-action', authenticate, requireRole('admin'), handler)
 */
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'User not authenticated'
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'Insufficient permissions',
        message: `This action requires one of: ${allowedRoles.join(', ')}`,
        currentRole: req.user.role
      });
    }

    next();
  };
}

/**
 * Check if user is a team member (or admin)
 * Uses team_id from req.params or req.body
 */
async function requireTeamMember(req, res, next) {
  const { query: dbQuery } = require('../config/database');
  const teamId = req.params.teamId || req.body.teamId || req.body.team_id;

  if (!teamId) {
    return res.status(400).json({ error: 'Team ID is required' });
  }

  // Admins can access any team
  if (req.user.role === 'admin') {
    return next();
  }

  try {
    const result = await dbQuery(
      'SELECT role FROM team_members WHERE team_id = $1 AND user_id = $2',
      [teamId, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(403).json({
        error: 'Not a team member',
        message: 'You are not a member of this team'
      });
    }

    req.teamRole = result.rows[0].role;
    next();
  } catch (error) {
    console.error('[Role Check] Error:', error.message);
    res.status(500).json({ error: 'Permission check failed' });
  }
}

module.exports = { requireRole, requireTeamMember };
