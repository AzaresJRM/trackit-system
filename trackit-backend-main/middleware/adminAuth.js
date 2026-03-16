const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'trackit-secret-key';

function isAdminPayload(decoded) {
  if (!decoded) return false;
  const role = decoded.role ? String(decoded.role).toLowerCase() : '';
  const username = decoded.username ? String(decoded.username).toLowerCase() : '';
  return role === 'admin' || role === 'superadmin' || username === 'admin';
}

function requireAdmin(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) {
    return res.status(401).json({ message: 'Missing authorization token.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (!isAdminPayload(decoded)) {
      return res.status(403).json({ message: 'Forbidden: admin access required.' });
    }
    req.user = decoded;
    return next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired token.' });
  }
}

module.exports = {
  requireAdmin
};
