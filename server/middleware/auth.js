// Auth middleware. Ensures valid user roles on certain routes.
function requireAuth(req, res, next) {
  if (!req.session.user) return res.status(401).json({ error: 'Please sign in.' });
  next();
}

function requireAdmin(req, res, next) {
  if (!req.session.user) return res.status(401).json({ error: 'Please sign in.' });
  if (req.session.user.role !== 'admin') return res.status(403).json({ error: 'Admins only.' });
  next();
}

module.exports = { requireAuth, requireAdmin };